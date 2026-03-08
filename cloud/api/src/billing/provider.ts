import crypto from "node:crypto";
import type { Env } from "../env.js";

export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled" | "suspended" | "failed";

export type CreatePixInvoiceInput = {
  invoiceId: string;
  amountCents: number;
  currency: string;
  description: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl?: string;
};

export type CreatePixInvoiceResult = {
  provider: string;
  externalId: string;
  status: InvoiceStatus;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expiresAt: string | null;
  raw: unknown;
};

export type WebhookNormalizeResult = {
  provider: string;
  eventId: string;
  paymentExternalId: string;
  raw: unknown;
};

export type PaymentStatusResult = {
  externalId: string;
  invoiceStatus: InvoiceStatus;
  paidAt: string | null;
  raw: unknown;
};

export interface BillingProvider {
  name: string;
  createPixInvoice(input: CreatePixInvoiceInput): Promise<CreatePixInvoiceResult>;
  normalizeWebhook(body: unknown, headers: Record<string, string | string[] | undefined>): WebhookNormalizeResult;
  fetchPaymentStatus(paymentExternalId: string): Promise<PaymentStatusResult>;
}

function toStatusMercadoPago(value: string): InvoiceStatus {
  const parsed = String(value || "").trim().toLowerCase();
  if (parsed === "approved") return "paid";
  if (parsed === "cancelled") return "cancelled";
  if (parsed === "rejected") return "failed";
  if (parsed === "charged_back") return "failed";
  if (parsed === "refunded") return "failed";
  if (parsed === "expired") return "overdue";
  if (parsed === "in_process") return "pending";
  if (parsed === "in_mediation") return "pending";
  return "pending";
}

function inferEventId(body: any, headers: Record<string, string | string[] | undefined>): string {
  const candidates = [
    body?.id,
    body?.data?.id,
    body?.resource,
    body?.topic,
    headers["x-idempotency-key"],
    headers["x-request-id"],
    headers["x-signature"]
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return `evt_${crypto.randomUUID()}`;
}

function toHeadersObject(
  headers: Record<string, string | string[] | undefined>,
  extra: Record<string, string> = {}
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const str = Array.isArray(value) ? String(value[0] || "") : String(value || "");
    if (!str) continue;
    normalized[key.toLowerCase()] = str;
  }
  for (const [key, value] of Object.entries(extra)) {
    normalized[key.toLowerCase()] = String(value);
  }
  return normalized;
}

class MercadoPagoPixProvider implements BillingProvider {
  name = "mercado_pago";
  private readonly accessToken: string;
  private readonly webhookSecret: string;

  constructor(env: Env) {
    this.accessToken = String(env.HSP_MP_ACCESS_TOKEN || "").trim();
    this.webhookSecret = String(env.HSP_MP_WEBHOOK_SECRET || "").trim();
  }

  private ensureToken() {
    if (!this.accessToken) {
      throw new Error("Mercado Pago não configurado. Defina HSP_MP_ACCESS_TOKEN no servidor.");
    }
  }

  async createPixInvoice(input: CreatePixInvoiceInput): Promise<CreatePixInvoiceResult> {
    this.ensureToken();
    const amount = Number(input.amountCents || 0) / 100;
    const notificationUrl = String(input.notificationUrl || "").trim() || undefined;
    const payload = {
      transaction_amount: Number(amount.toFixed(2)),
      description: input.description,
      payment_method_id: "pix",
      payer: {
        email: input.payerEmail || "cliente@helpsystem.local"
      },
      external_reference: input.externalReference,
      notification_url: notificationUrl
    };

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.invoiceId
      },
      body: JSON.stringify(payload)
    });
    const raw = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      const message =
        String(raw?.message || "") ||
        String(raw?.error || "") ||
        "Falha ao gerar cobrança PIX no provedor de pagamentos.";
      throw new Error(message);
    }

    const tx = raw?.point_of_interaction?.transaction_data || {};
    return {
      provider: this.name,
      externalId: String(raw?.id || ""),
      status: toStatusMercadoPago(String(raw?.status || "")),
      qrCode: String(tx?.qr_code || ""),
      qrCodeBase64: String(tx?.qr_code_base64 || ""),
      ticketUrl: String(tx?.ticket_url || ""),
      expiresAt: raw?.date_of_expiration ? String(raw.date_of_expiration) : null,
      raw
    };
  }

  normalizeWebhook(body: unknown, headers: Record<string, string | string[] | undefined>): WebhookNormalizeResult {
    const raw = (body || {}) as any;
    const paymentId = String(raw?.data?.id || raw?.id || "").trim();
    if (!paymentId) {
      throw new Error("Webhook sem identificador de pagamento.");
    }

    const signature = String(headers["x-signature"] || "");
    if (this.webhookSecret && signature && !signature.includes(this.webhookSecret)) {
      throw new Error("Webhook recusado por assinatura inválida.");
    }

    return {
      provider: this.name,
      eventId: inferEventId(raw, headers),
      paymentExternalId: paymentId,
      raw
    };
  }

  async fetchPaymentStatus(paymentExternalId: string): Promise<PaymentStatusResult> {
    this.ensureToken();
    const externalId = String(paymentExternalId || "").trim();
    if (!externalId) throw new Error("Pagamento inválido para consulta.");
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(externalId)}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    });
    const raw = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      const message = String(raw?.message || raw?.error || "Falha ao consultar status do pagamento no provedor.");
      throw new Error(message);
    }
    const status = toStatusMercadoPago(String(raw?.status || ""));
    return {
      externalId,
      invoiceStatus: status,
      paidAt: raw?.date_approved ? String(raw.date_approved) : null,
      raw
    };
  }
}

class MockPixProvider implements BillingProvider {
  name = "mock_pix";
  private readonly statusByExternalId = new Map<string, PaymentStatusResult>();

  async createPixInvoice(input: CreatePixInvoiceInput): Promise<CreatePixInvoiceResult> {
    const externalId = `mock_${input.invoiceId}`;
    const qrCode = `PIX-MOCK|${externalId}|${input.amountCents}|${input.currency}|${Date.now()}`;
    const qrCodeBase64 = Buffer.from(qrCode, "utf8").toString("base64");
    this.statusByExternalId.set(externalId, {
      externalId,
      invoiceStatus: "pending",
      paidAt: null,
      raw: { status: "pending" }
    });
    return {
      provider: this.name,
      externalId,
      status: "pending",
      qrCode,
      qrCodeBase64: `data:image/png;base64,${qrCodeBase64}`,
      ticketUrl: `https://mock-pix.local/pay/${encodeURIComponent(externalId)}`,
      expiresAt: null,
      raw: {
        mode: "mock_pix",
        note: "Cobranca de teste local",
        externalId
      }
    };
  }

  normalizeWebhook(body: unknown, headers: Record<string, string | string[] | undefined>): WebhookNormalizeResult {
    const raw = (body || {}) as any;
    const paymentExternalId = String(raw?.payment_external_id || raw?.external_id || raw?.data?.id || raw?.id || "").trim();
    if (!paymentExternalId) {
      throw new Error("Webhook mock sem identificador da cobranca.");
    }

    const statusRaw = String(raw?.status || raw?.invoice_status || "pending").trim().toLowerCase();
    const status =
      statusRaw === "paid"
        ? "paid"
        : statusRaw === "overdue"
          ? "overdue"
          : statusRaw === "cancelled"
            ? "cancelled"
            : statusRaw === "suspended"
              ? "suspended"
              : statusRaw === "failed"
                ? "failed"
                : "pending";
    const paidAt = status === "paid" ? String(raw?.paid_at || new Date().toISOString()) : null;
    this.statusByExternalId.set(paymentExternalId, {
      externalId: paymentExternalId,
      invoiceStatus: status,
      paidAt,
      raw
    });

    return {
      provider: this.name,
      eventId: inferEventId(raw, headers),
      paymentExternalId,
      raw
    };
  }

  async fetchPaymentStatus(paymentExternalId: string): Promise<PaymentStatusResult> {
    const externalId = String(paymentExternalId || "").trim();
    if (!externalId) throw new Error("Cobranca mock invalida para consulta.");
    const current = this.statusByExternalId.get(externalId);
    if (current) return current;
    return {
      externalId,
      invoiceStatus: "pending",
      paidAt: null,
      raw: { status: "pending" }
    };
  }
}

export function createBillingProvider(env: Env): BillingProvider {
  const provider = String(env.HSP_BILLING_PROVIDER || "").trim().toLowerCase();
  if (provider === "mock_pix" || provider === "mock" || provider === "local") {
    return new MockPixProvider();
  }
  if (!provider || provider === "mercado_pago" || provider === "mercadopago") {
    return new MercadoPagoPixProvider(env);
  }
  throw new Error(`Provedor de cobrança não suportado: ${provider}`);
}

export function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  return toHeadersObject(headers);
}
