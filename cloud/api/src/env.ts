import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8802),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  HSP_ENCRYPTION_KEY_BASE64: z.string().min(16),
  HSP_BOOTSTRAP_CODE: z.string().min(8),
  HSP_MASTER_EMAIL: z.string().email().optional(),
  HSP_BASE_URL: z.string().optional().default("http://localhost:8802"),
  HSP_BILLING_PROVIDER: z.string().optional().default("mercado_pago"),
  HSP_BILLING_GRACE_DAYS: z.coerce.number().optional().default(3),
  HSP_MP_ACCESS_TOKEN: z.string().optional().default(""),
  HSP_MP_WEBHOOK_SECRET: z.string().optional().default(""),
  HSP_MP_NOTIFICATION_URL: z.string().optional().default(""),
  NODE_ENV: z.string().optional().default("development")
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Env inválida: ${issues}`);
  }
  return parsed.data;
}
