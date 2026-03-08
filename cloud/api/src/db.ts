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

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'starter',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

    CREATE TABLE IF NOT EXISTS licenses (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'starter',
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ,
      machine_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_tenant ON licenses(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'paid',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_billing_events_status ON billing_events(status);
    CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON billing_events(tenant_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      subscription_id TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,
      provider TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'pending',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'BRL',
      due_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      external_id TEXT,
      external_payload TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_external_id ON invoices(external_id) WHERE external_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS payment_webhooks (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'received',
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhooks_provider_event ON payment_webhooks(provider, event_id);
    CREATE INDEX IF NOT EXISTS idx_payment_webhooks_status ON payment_webhooks(status);

    CREATE TABLE IF NOT EXISTS bot_status (
      tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      is_online BOOLEAN NOT NULL DEFAULT FALSE,
      last_seen TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS onboarding_requests (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      requested_plan TEXT NOT NULL DEFAULT 'starter',
      requested_cycle TEXT NOT NULL DEFAULT 'monthly',
      objective TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT NOT NULL DEFAULT '',
      payment_reference TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      approved_tenant_id TEXT,
      approved_user_id TEXT,
      approved_by_user_id TEXT,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status ON onboarding_requests(status);
    CREATE INDEX IF NOT EXISTS idx_onboarding_requests_payment ON onboarding_requests(payment_status);
    CREATE INDEX IF NOT EXISTS idx_onboarding_requests_email ON onboarding_requests(email);

    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';
    ALTER TABLE licenses ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS requested_cycle TEXT NOT NULL DEFAULT 'monthly';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS objective TEXT NOT NULL DEFAULT '';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS payment_reference TEXT NOT NULL DEFAULT '';
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS approved_tenant_id TEXT;
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS approved_user_id TEXT;
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS approved_by_user_id TEXT;
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE onboarding_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'manual';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_id TEXT;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS external_payload TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
}
