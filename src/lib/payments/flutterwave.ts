import "server-only";
import { createHash } from "crypto";

/**
 * Thin Flutterwave v3 client — just the two calls the wallet top-up flow
 * needs. Lives outside repo.ts on purpose: repo.ts is the data access layer
 * (Postgres or the demo store), this is an external HTTP client, the same
 * separation session.ts already keeps from repo.ts.
 *
 * verifyFlutterwaveTransaction() is the only source of truth for whether a
 * payment actually happened — callers must never trust a redirect
 * query-string's `status` or a webhook body's amount directly.
 */

const FLW_BASE = "https://api.flutterwave.com/v3";

function secretKey(): string | null {
  return process.env.FLUTTERWAVE_SECRET_KEY || null;
}

export function isFlutterwaveConfigured(): boolean {
  return Boolean(secretKey());
}

export async function initializeFlutterwavePayment(opts: {
  reference: string;
  amountKobo: number;
  email: string;
  name: string;
  redirectUrl: string;
  title?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const secret = secretKey();
  if (!secret) return { ok: false, error: "Payments are not configured yet." };

  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: opts.reference,
      // Flutterwave takes major currency units (naira), never kobo.
      amount: amountInNaira(opts.amountKobo),
      currency: "NGN",
      redirect_url: opts.redirectUrl,
      customer: { email: opts.email, name: opts.name },
      meta: {
        product: "tempo",
        type: "action_payment",
        reference: opts.reference,
        ...opts.metadata,
      },
      customizations: {
        title: opts.title ?? "Tempo Payment",
        description: opts.description ?? "Pay securely on Tempo",
      },
      // Protect the amount, currency, customer email and Tempo reference from
      // alteration between payment-link creation and Flutterwave checkout.
      payload_hash: paymentPayloadHash({
        amount: amountInNaira(opts.amountKobo),
        email: opts.email,
        reference: opts.reference,
        secret,
      }),
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success" || !json?.data?.link) {
    return { ok: false, error: json?.message ?? "Could not start payment." };
  }
  return { ok: true, link: json.data.link as string };
}

function amountInNaira(amountKobo: number) {
  return (amountKobo / 100).toFixed(2);
}

function paymentPayloadHash(input: { amount: string; email: string; reference: string; secret: string }) {
  const secretHash = createHash("sha256").update(input.secret, "utf8").digest("hex");
  return createHash("sha256")
    .update(`${input.amount}NGN${input.email}${input.reference}${secretHash}`, "utf8")
    .digest("hex");
}

export async function verifyFlutterwaveTransaction(transactionId: string): Promise<
  | {
      ok: true;
      amountKobo: number;
      currency: string;
      txRef: string;
      status: string;
      raw: unknown;
    }
  | { ok: false; error: string }
> {
  const secret = secretKey();
  if (!secret) return { ok: false, error: "Payments are not configured yet." };

  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const json = await res.json().catch(() => null);
  const data = json?.data;
  if (!res.ok || json?.status !== "success" || !data) {
    return { ok: false, error: json?.message ?? "Could not verify payment." };
  }

  return {
    ok: true,
    amountKobo: Math.round(Number(data.amount) * 100),
    currency: String(data.currency ?? ""),
    txRef: String(data.tx_ref ?? ""),
    status: String(data.status ?? ""),
    raw: data,
  };
}
