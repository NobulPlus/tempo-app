import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { completeVerifiedWalletTopup } from "@/lib/payments/wallet";

/**
 * Durable backstop for wallet top-ups: covers the case where a user closes
 * the tab before /wallet/callback runs. Flutterwave signs this with the
 * verif-hash header (set alongside the webhook URL in the dashboard) —
 * anyone who doesn't know FLUTTERWAVE_SECRET_HASH is rejected outright.
 *
 * The webhook body's amount/status is never trusted directly either — same
 * as the callback page, this re-verifies with Flutterwave's API using the
 * secret key before crediting anything. complete_wallet_topup() is
 * idempotent on `reference`, so this running after (or instead of, or
 * racing) the callback page is safe.
 */
export async function POST(request: Request) {
  const expectedHash = process.env.FLUTTERWAVE_SECRET_HASH;
  const rawBody = await request.text();
  const legacySignature = request.headers.get("verif-hash");
  const hmacSignature = request.headers.get("flutterwave-signature");

  if (!expectedHash || !isValidSignature(rawBody, expectedHash, legacySignature, hmacSignature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = safeJson(rawBody);
  const transactionId = body?.data?.id;
  const txRef = body?.data?.tx_ref;
  if (!transactionId || !txRef) {
    return NextResponse.json({ error: "missing transaction id" }, { status: 400 });
  }

  const verified = await verifyFlutterwaveTransaction(String(transactionId));
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 502 });
  }
  if (verified.status !== "successful" || verified.currency !== "NGN" || verified.txRef !== txRef) {
    // Not an error — just nothing to credit (failed/pending payment webhook).
    return NextResponse.json({ ok: true, skipped: true });
  }

  const completed = await completeVerifiedWalletTopup({
    reference: verified.txRef,
    amountKobo: verified.amountKobo,
    providerRef: String(transactionId),
    raw: verified.raw,
  });

  if (!completed.ok) {
    return NextResponse.json({ error: completed.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function isValidSignature(
  rawBody: string,
  secretHash: string,
  legacySignature: string | null,
  hmacSignature: string | null,
) {
  if (legacySignature && safeEqual(legacySignature, secretHash)) return true;
  if (!hmacSignature) return false;

  const digest = createHmac("sha256", secretHash).update(rawBody).digest("base64");
  return safeEqual(hmacSignature, digest);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeJson(rawBody: string) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}
