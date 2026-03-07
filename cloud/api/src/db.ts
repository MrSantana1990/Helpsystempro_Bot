import pg from "pg";
import { getEnv } from "./env.js";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function pool(): pg.Pool {
  if (_pool) return _pool;
  const env = getEnv();
  _pool = new Pool({ connectionString: env.DATABASE_URL });
  return _pool;
}

export async function dbInit(): Promise<void> {
  const p = pool();
  // Tabelas mínimas para SaaS (MVP): usuários, tenants, vínculo e logs de auditoria.
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      totp_secret_enc TEXT,
      totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'starter',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_tenants (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, tenant_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_id TEXT,
      tenant_id TEXT,
      action TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}'
    );
  `);
}

