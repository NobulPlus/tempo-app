import "server-only";

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

export async function initializeFlutterwavePayment(opts: {
  reference: string;
  amountKobo: number;
  email: string;
  name: string;
  redirectUrl: string;
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
      amount: (opts.amountKobo / 100).toFixed(2),
      currency: "NGN",
      redirect_url: opts.redirectUrl,
      customer: { email: opts.email, name: opts.name },
      customizations: {
        title: "Tempo Wallet Top-up",
        description: "Add funds to your Tempo wallet",
      },
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success" || !json?.data?.link) {
    return { ok: false, error: json?.message ?? "Could not start payment." };
  }
  return { ok: true, link: json.data.link as string };
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
