import { NextResponse } from "next/server";
import { completeVerifiedActionPayment } from "@/lib/payments/action-payments";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { completeVerifiedWalletTopup } from "@/lib/payments/wallet";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recovers a payment if a customer closes the checkout window or Kora cannot
 * reach our webhook. Only Kora references are reconcilable by merchant
 * reference; Flutterwave's verification API requires its transaction id,
 * which Tempo receives through the redirect or signed webhook.
 */
const MAX_PER_RUN = 50;
const LOOKBACK_HOURS = 72;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const [topups, actions] = await Promise.all([
    admin
      .from("wallet_transactions")
      .select("reference")
      .eq("type", "topup")
      .eq("status", "pending")
      .eq("provider", "korapay")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN),
    admin
      .from("action_payment_intents")
      .select("reference")
      .eq("status", "pending")
      .eq("provider", "korapay")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN),
  ]);

  if (topups.error || actions.error) {
    const message = topups.error?.message ?? actions.error?.message ?? "Could not query pending payments.";
    console.error("[cron/payment-reconciliation] pending query failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let checked = 0;
  let completed = 0;
  let pending = 0;
  let failed = 0;

  for (const reference of [...(topups.data ?? []), ...(actions.data ?? [])].map((row) => row.reference)) {
    checked++;
    try {
      const verified = await verifyKorapayTransaction(reference);
      if (!verified.ok) {
        failed++;
        console.error(`[cron/payment-reconciliation] ${reference}: ${verified.error}`);
        continue;
      }
      if (verified.status !== "success" || verified.currency !== "NGN") {
        pending++;
        continue;
      }

      const result = reference.startsWith("TOPUP-")
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

      if (result.ok) completed++;
      else {
        failed++;
        console.error(`[cron/payment-reconciliation] ${reference}: ${result.error}`);
      }
    } catch (error) {
      failed++;
      console.error(`[cron/payment-reconciliation] ${reference}:`, error);
    }
  }

  return NextResponse.json({ checked, completed, pending, failed });
}
