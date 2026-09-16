import "server-only";

const KORA_BASE = "https://api.korapay.com/merchant/api/v1";

function secretKey(): string | null {
  return process.env.KORAPAY_SECRET_KEY || null;
}

export function isKorapayConfigured(): boolean {
  return Boolean(secretKey());
}

export async function initializeKorapayPayment(opts: {
  reference: string;
  amountKobo: number;
  email: string;
  name: string;
  redirectUrl: string;
  notificationUrl: string;
  narration?: string;
  metadata?: Record<string, string>;
}): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const secret = secretKey();
  if (!secret) return { ok: false, error: "Korapay is not configured yet." };

  const res = await fetch(`${KORA_BASE}/charges/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference: opts.reference,
      amount: opts.amountKobo / 100,
      currency: "NGN",
      redirect_url: opts.redirectUrl,
      notification_url: opts.notificationUrl,
      merchant_bears_cost: false,
      narration: opts.narration ?? "Tempo payment",
      customer: { email: opts.email, name: opts.name },
      metadata: {
        product: "tempo",
        type: "action_payment",
        reference: opts.reference,
        ...opts.metadata,
      },
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== true || !json?.data?.checkout_url) {
    return { ok: false, error: json?.message ?? "Could not start Korapay payment." };
  }

  return { ok: true, link: String(json.data.checkout_url) };
}

export async function verifyKorapayTransaction(reference: string): Promise<
  | {
      ok: true;
      amountKobo: number;
      currency: string;
      merchantReference: string;
      providerRef: string;
      status: string;
      raw: unknown;
    }
  | { ok: false; error: string }
> {
  const secret = secretKey();
  if (!secret) return { ok: false, error: "Korapay is not configured yet." };

  const res = await fetch(`${KORA_BASE}/charges/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const json = await res.json().catch(() => null);
  const data = json?.data;
  if (!res.ok || json?.status !== true || !data) {
    return { ok: false, error: json?.message ?? "Could not verify Korapay payment." };
  }

  const merchantReference = extractTempoReference(data) ?? reference;
  const grossAmount = Number(data.amount_paid ?? data.amount ?? 0);
  const fee = Number(data.fee ?? 0);
  const amount = fee > 0 && grossAmount > fee ? grossAmount - fee : grossAmount;

  return {
    ok: true,
    amountKobo: Math.round(amount * 100),
    currency: String(data.currency ?? ""),
    merchantReference,
    providerRef: String(data.reference ?? data.transaction_reference ?? reference),
    status: normalizeStatus(data.status),
    raw: data,
  };
}

function normalizeStatus(status: unknown) {
  const value = String(status ?? "").toLowerCase();
  return value === "successful" ? "success" : value;
}

function extractTempoReference(data: unknown): string | null {
  if (!isRecord(data)) return null;

  const metadata = data.metadata;
  const metadataReference = isRecord(metadata) ? metadata.reference : null;
  const candidates = [
    metadataReference,
    data.payment_reference,
    data.tx_ref,
    data.transaction_reference,
    data.reference,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^(TOPUP|BKG|HST|GPY|GBL)-/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
