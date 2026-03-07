import { TRPCError } from "@trpc/server";
import { z } from "zod";
import QRCode from "qrcode";
import { pool } from "../db.js";
import { id } from "../ids.js";
import { encryptText, decryptText } from "../crypto.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signJwt } from "../auth/jwt.js";
import { generateTotpSecret, totpOtpAuthUrl, totpVerify } from "../auth/totp.js";
import { getEnv } from "../env.js";
import { publicProcedure, router, authedProcedure, zEmail } from "../trpc.js";

async function anyUserExists(): Promise<boolean> {
  const p = pool();
  const r = await p.query("SELECT 1 FROM users LIMIT 1");
  return r.rowCount > 0;
}

async function getUserByEmail(email: string) {
  const p = pool();
  const r = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [email.toLowerCase()]);
  return r.rows[0] || null;
}

export const authRouter = router({
  bootstrapAdmin: publicProcedure
    .input(
      z.object({
        bootstrapCode: z.string().min(4),
        email: zEmail,
        password: z.string().min(8)
      })
    )
    .mutation(async ({ input }) => {
      const env = getEnv();
      if (await anyUserExists()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bootstrap já concluído." });
      }
      if (input.bootstrapCode !== env.HSP_BOOTSTRAP_CODE) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Código inválido." });
      }
      const p = pool();
      const userId = id("usr");
      const pw = await hashPassword(input.password);
      await p.query(
        "INSERT INTO users (id, email, password_hash, role, totp_enabled) VALUES ($1,$2,$3,'admin',FALSE)",
        [userId, input.email.toLowerCase(), pw]
      );
      return { ok: true, userId };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: zEmail,
        password: z.string().min(1),
        totp: z.string().optional()
      })
    )
    .mutation(async ({ input }) => {
      const p = pool();
      const u = await getUserByEmail(input.email);
      if (!u) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      const ok = await verifyPassword(String(input.password), String(u.password_hash));
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });

      if (!u.totp_enabled) {
        return { ok: false, step: "TOTP_SETUP_REQUIRED" as const };
      }

      const secretEnc = String(u.totp_secret_enc || "");
      if (!secretEnc) throw new TRPCError({ code: "FAILED_PRECONDITION", message: "2FA inconsistente (secret ausente)." });
      const secret = decryptText(secretEnc);
      if (!input.totp || !totpVerify(secret, input.totp)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "TOTP inválido." });
      }

      const tenantIdsR = await p.query("SELECT tenant_id FROM user_tenants WHERE user_id=$1", [u.id]);
      const tenantIds = tenantIdsR.rows.map((x: any) => String(x.tenant_id));
      const token = signJwt({ sub: String(u.id), role: u.role === "admin" ? "admin" : "user", tenantIds });
      return { ok: true, token, role: u.role, tenantIds };
    }),

  totpSetupStartPublic: publicProcedure
    .input(z.object({ email: zEmail, password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const p = pool();
      const u = await getUserByEmail(input.email);
      if (!u) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      const ok = await verifyPassword(String(input.password), String(u.password_hash));
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      if (u.totp_enabled) throw new TRPCError({ code: "FAILED_PRECONDITION", message: "2FA já está ativo." });

      const { secret } = generateTotpSecret();
      const issuer = "HelpSystem Pro";
      const label = String(u.email || u.id);
      const otpauth = totpOtpAuthUrl({ issuer, label, secret });
      const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
      await p.query("UPDATE users SET totp_secret_enc=$1 WHERE id=$2", [encryptText(secret), String(u.id)]);
      return { otpauth, qrDataUrl };
    }),

  totpEnablePublic: publicProcedure
    .input(z.object({ email: zEmail, password: z.string().min(1), code: z.string().min(4) }))
    .mutation(async ({ input }) => {
      const p = pool();
      const u = await getUserByEmail(input.email);
      if (!u) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      const ok = await verifyPassword(String(input.password), String(u.password_hash));
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Credenciais inválidas." });
      if (u.totp_enabled) return { ok: true };
      if (!u.totp_secret_enc) throw new TRPCError({ code: "FAILED_PRECONDITION", message: "Faça o setup primeiro." });
      const secret = decryptText(String(u.totp_secret_enc));
      if (!totpVerify(secret, input.code)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
      await p.query("UPDATE users SET totp_enabled=TRUE WHERE id=$1", [String(u.id)]);
      return { ok: true };
    }),

  totpSetupStart: authedProcedure.mutation(async ({ ctx }) => {
    const p = pool();
    const u = await p.query("SELECT totp_enabled FROM users WHERE id=$1", [ctx.user!.id]);
    if (!u.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    if (u.rows[0].totp_enabled) throw new TRPCError({ code: "FAILED_PRECONDITION", message: "2FA já está ativo." });

    const { secret } = generateTotpSecret();
    const issuer = "HelpSystem Pro";
    const label = ctx.user!.id;
    const otpauth = totpOtpAuthUrl({ issuer, label, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });

    // Salva o secret criptografado, mas ainda não habilita até validar 1 código.
    await p.query("UPDATE users SET totp_secret_enc=$1 WHERE id=$2", [encryptText(secret), ctx.user!.id]);
    return { otpauth, qrDataUrl };
  }),

  totpEnable: authedProcedure
    .input(z.object({ code: z.string().min(4) }))
    .mutation(async ({ ctx, input }) => {
      const p = pool();
      const r = await p.query("SELECT totp_secret_enc, totp_enabled FROM users WHERE id=$1", [ctx.user!.id]);
      const u = r.rows[0];
      if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      if (u.totp_enabled) return { ok: true };
      if (!u.totp_secret_enc) throw new TRPCError({ code: "FAILED_PRECONDITION", message: "Faça o setup primeiro." });
      const secret = decryptText(String(u.totp_secret_enc));
      if (!totpVerify(secret, input.code)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
      await p.query("UPDATE users SET totp_enabled=TRUE WHERE id=$1", [ctx.user!.id]);
      return { ok: true };
    }),

  me: authedProcedure.query(async ({ ctx }) => {
    const p = pool();
    const r = await p.query("SELECT id,email,role,totp_enabled,created_at FROM users WHERE id=$1", [ctx.user!.id]);
    const u = r.rows[0];
    if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    return { user: u, tenantIds: ctx.user!.tenantIds };
  })
});
