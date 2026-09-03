import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

interface CompleteTopupInput {
  reference: string;
  amountKobo: number;
  providerRef: string;
  raw: unknown;
}

type CompleteTopupResult = { ok: true } | { ok: false; error: string };

/**
 * Completes a verified wallet top-up.
 *
 * 0014 moves the amount check into Postgres. While a live database is catching
 * up to that migration, this still verifies the pending ledger row before
 * falling back to the older service-role-only function signature.
 */
export async function completeVerifiedWalletTopup(
  input: CompleteTopupInput,
): Promise<CompleteTopupResult> {
  const admin = createAdminClient();
  const expected = await getExpectedTopup(admin, input.reference);
  if (!expected.ok) return expected;

  if (expected.completed) return { ok: true };
  if (expected.amountKobo !== input.amountKobo) {
    return { ok: false, error: "Top-up amount mismatch. Nothing was credited." };
  }

  const { error } = await admin.rpc("complete_wallet_topup", {
    p_reference: input.reference,
    p_amount_kobo: input.amountKobo,
    p_provider_ref: input.providerRef,
    p_raw: input.raw as object,
  });

  if (!isMissingNewSignature(error)) {
    if (error) return { ok: false, error: error.message };
    revalidateWalletViews();
    return { ok: true };
  }

  const fallback = await admin.rpc("complete_wallet_topup", {
    p_reference: input.reference,
    p_provider_ref: input.providerRef,
    p_raw: input.raw as object,
  });

  if (fallback.error) return { ok: false, error: fallback.error.message };
  revalidateWalletViews();
  return { ok: true };
}

/**
 * The nav's wallet-balance chip lives in the root layout, which Next.js's
 * client router can keep a stale cached render of even across a hard
 * navigation back from an external redirect (Flutterwave). Only
 * revalidatePath('/', 'layout') reliably busts that — narrower paths like
 * '/wallet' leave the shared layout segment alone. This only takes effect
 * when called from a genuine Server Action or Route Handler execution
 * context (Next.js requirement) — see finalizeWalletTopupAction in
 * actions.ts, which is what the callback page actually calls.
 */
function revalidateWalletViews() {
  revalidatePath("/", "layout");
}

async function getExpectedTopup(
  admin: ReturnType<typeof createAdminClient>,
  reference: string,
): Promise<
  | { ok: true; amountKobo: number; completed: boolean }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("wallet_transactions")
    .select("amount_kobo, status, type")
    .eq("reference", reference)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Unknown wallet top-up reference." };
  if (data.type !== "topup") return { ok: false, error: "That reference is not a wallet top-up." };

  return {
    ok: true,
    amountKobo: Number(data.amount_kobo),
    completed: data.status === "completed",
  };
}

function isMissingNewSignature(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    Boolean(error.message?.includes("Could not find the function public.complete_wallet_topup"))
  );
}
