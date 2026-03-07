import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { pool } from "../db.js";
import { id } from "../ids.js";
import { hashPassword } from "../auth/password.js";
import { adminProcedure, router, zEmail } from "../trpc.js";

export const adminRouter = router({
  usersList: adminProcedure.query(async () => {
    const p = pool();
    const r = await p.query("SELECT id,email,role,totp_enabled,created_at FROM users ORDER BY created_at DESC LIMIT 500");
    return { rows: r.rows };
  }),

  usersCreate: adminProcedure
    .input(
      z.object({
        email: zEmail,
        password: z.string().min(8),
        role: z.enum(["admin", "user"]).default("user")
      })
    )
    .mutation(async ({ input }) => {
      const p = pool();
      const userId = id("usr");
      const pw = await hashPassword(input.password);
      try {
        await p.query("INSERT INTO users (id,email,password_hash,role,totp_enabled) VALUES ($1,$2,$3,$4,FALSE)", [
          userId,
          input.email.toLowerCase(),
          pw,
          input.role
        ]);
      } catch (e: any) {
        throw new TRPCError({ code: "CONFLICT", message: "Email já existe." });
      }
      return { ok: true, userId };
    }),

  tenantsList: adminProcedure.query(async () => {
    const p = pool();
    const r = await p.query("SELECT id,name,plan,status,created_at FROM tenants ORDER BY created_at DESC LIMIT 500");
    return { rows: r.rows };
  }),

  tenantsCreate: adminProcedure
    .input(z.object({ name: z.string().min(2), plan: z.string().default("starter") }))
    .mutation(async ({ input }) => {
      const p = pool();
      const tenantId = id("tnt");
      await p.query("INSERT INTO tenants (id,name,plan,status) VALUES ($1,$2,$3,'active')", [tenantId, input.name, input.plan]);
      return { ok: true, tenantId };
    }),

  grantUserTenant: adminProcedure
    .input(z.object({ userId: z.string().min(1), tenantId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const p = pool();
      await p.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [input.userId, input.tenantId]);
      return { ok: true };
    })
});

