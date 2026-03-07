import jwt from "jsonwebtoken";
import { getEnv } from "../env.js";

export type JwtPayload = {
  sub: string;
  role: "admin" | "user";
  tenantIds: string[];
};

export function signJwt(payload: JwtPayload): string {
  const env = getEnv();
  return jwt.sign(payload, env.JWT_SECRET, { algorithm: "HS256", expiresIn: "12h" });
}

export function verifyJwt(token: string): JwtPayload {
  const env = getEnv();
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}

