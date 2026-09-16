import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { completeVerifiedWalletTopup } from "@/lib/payments/wallet";
import { completeVerifiedActionPayment } from "@/lib/payments/action-payments";

/**
 * Durable Korapay wallet top-up confirmation. Korapay signs the webhook with
 * x-korapay-signature: HMAC-SHA256(JSON.stringify(body.data), secret_key).
 * The webhook body is still not trusted for value delivery; after signature
 * validation we query Korapay's charge endpoint and only credit verified
 * successful NGN payments.
 */
export async function POST(request: Request) {
  const secret = process.env.KORAPAY_SECRET_KEY;
  const signature = request.headers.get("x-korapay-signature");
  const rawBody = await request.text();
  const body = safeJson(rawBody);

  if (!secret || !signature || !body?.data || !isValidSignature(body.data, secret, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (!String(body.event ?? "").includes("charge.")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const providerReference =
    stringValue(body.data.reference) ??
    stringValue(body.data.transaction_reference) ??
    stringValue(body.data.payment_reference);
  const tempoReference = extractTempoReference(body.data);
  if (!providerReference && !tempoReference) {
    return NextResponse.json({ error: "missing reference" }, { status: 400 });
  }

  const verified = await verifyKorapayTransaction(providerReference ?? tempoReference ?? "");
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 502 });
  }
  if (verified.status !== "success" || verified.currency !== "NGN") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const reference = tempoReference ?? verified.merchantReference;
  const completed = reference.startsWith("TOPUP-")
    ? await completeVerifiedWalletTopup({
        reference,
        amountKobo: verified.amountKobo,
        providerRef: verified.providerRef,
        raw: verified.raw,
      })
    : await completeVerifiedActionPayment({
        reference,
        amountKobo: verified.amountKobo,
        providerRef: verified.providerRef,
        raw: verified.raw,
      });

  if (!completed.ok) {
    return NextResponse.json({ error: completed.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function isValidSignature(data: unknown, secret: string, signature: string) {
  const digest = createHmac("sha256", secret).update(JSON.stringify(data)).digest("hex");
  return safeEqual(signature, digest);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

type KorapayWebhookBody = {
  event?: string;
  data?: Record<string, unknown>;
};

function extractTempoReference(data: Record<string, unknown>) {
  const metadata = data.metadata;
  const metadataReference =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).reference
      : null;

  return [
    metadataReference,
    data.payment_reference,
    data.tx_ref,
    data.transaction_reference,
    data.reference,
  ].find((value) => typeof value === "string" && /^(TOPUP|BKG|HST|GPY|GBL)-/.test(value)) as string | undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function safeJson(rawBody: string): KorapayWebhookBody | null {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
