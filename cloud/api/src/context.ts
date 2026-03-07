import type { Request, Response } from "express";
import { verifyJwt, type JwtPayload } from "./auth/jwt.js";

export type ContextUser = JwtPayload & { id: string };

export type Context = {
  req: Request;
  res: Response;
  user: ContextUser | null;
};

function tokenFromReq(req: Request): string | null {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;

  const cookie = String(req.headers.cookie || "");
  const m = cookie.match(/(?:^|;\s*)hsp_token=([^;]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]);

  return null;
}

export function createContext(opts: { req: Request; res: Response }): Context {
  const token = tokenFromReq(opts.req);
  if (!token) return { ...opts, user: null };
  try {
    const payload = verifyJwt(token);
    return { ...opts, user: { ...payload, id: payload.sub } };
  } catch {
    return { ...opts, user: null };
  }
}

