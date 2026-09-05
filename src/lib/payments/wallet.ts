import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/transport";
import { walletTopupEmail } from "@/lib/mail/templates";

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
    await sendTopupReceipt(admin, expected.userId, input.reference, input.amountKobo);
    return { ok: true };
  }

  const fallback = await admin.rpc("complete_wallet_topup", {
    p_reference: input.reference,
    p_provider_ref: input.providerRef,
    p_raw: input.raw as object,
  });

  if (fallback.error) return { ok: false, error: fallback.error.message };
  revalidateWalletViews();
  await sendTopupReceipt(admin, expected.userId, input.reference, input.amountKobo);
  return { ok: true };
}

/** Never throws — a receipt failing to send must not undo a completed credit. */
async function sendTopupReceipt(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  reference: string,
  amountKobo: number,
) {
  try {
    const [{ data: authUser }, { data: profile }, { data: wallet }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      admin.from("wallets").select("balance_kobo").eq("user_id", userId).maybeSingle(),
    ]);
    const email = authUser?.user?.email;
    if (!email) return;

    const { subject, html, text } = walletTopupEmail({
      fullName: profile?.full_name ?? "there",
      amountKobo,
      balanceKobo: wallet?.balance_kobo ?? amountKobo,
      reference,
    });
    await sendMail({ to: email, subject, html, text });
  } catch (err) {
    console.error("[mail] wallet topup receipt failed:", err);
  }
}

/**
 * The nav's wallet-balance chip lives in the root layout, which Next.js's
 * client router can keep a stale cached render of even across a hard
 * navigation back from an external redirect (Flutterwave). Only
 * revalidatePath('/', 'layout') reliably busts that — narrower paths like
 * '/wallet' leave the shared layout segment alone. This only takes effect
 * when called from a genuine Server Action or Route Handler execution
 * context (Next.js requirement) — the wallet callback route
 * (app/wallet/callback/route.ts) and the Flutterwave webhook route both
 * qualify; a plain page component render does not.
 */
function revalidateWalletViews() {
  revalidatePath("/", "layout");
}

async function getExpectedTopup(
  admin: ReturnType<typeof createAdminClient>,
  reference: string,
): Promise<
  | { ok: true; amountKobo: number; completed: boolean; userId: string }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("wallet_transactions")
    .select("amount_kobo, status, type, user_id")
    .eq("reference", reference)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Unknown wallet top-up reference." };
  if (data.type !== "topup") return { ok: false, error: "That reference is not a wallet top-up." };

  return {
    ok: true,
    amountKobo: Number(data.amount_kobo),
    completed: data.status === "completed",
    userId: data.user_id,
  };
}

function isMissingNewSignature(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST202" ||
    Boolean(error.message?.includes("Could not find the function public.complete_wallet_topup"))
  );
}
