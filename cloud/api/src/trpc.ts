import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./context.js";
import { pool } from "./db.js";
import { getEnv } from "./env.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado." });
  return next({ ctx });
});

export const adminProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admin." });
  return next({ ctx });
}).use(async ({ ctx, next }) => {
  const master = String(getEnv().HSP_MASTER_EMAIL || "").trim().toLowerCase();
  if (!master) return next({ ctx });
  const p = pool();
  const r = await p.query("SELECT email FROM users WHERE id=$1 LIMIT 1", [ctx.user!.id]);
  const email = String(r.rows?.[0]?.email || "").trim().toLowerCase();
  if (!email || email !== master) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas master pode gerenciar este painel." });
  return next({ ctx });
});

export const zEmail = z.string().email();
