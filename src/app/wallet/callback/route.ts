import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { completeVerifiedWalletTopup } from "@/lib/payments/wallet";

/**
 * Where Flutterwave sends the browser back after checkout. A Route Handler,
 * not a page — completeVerifiedWalletTopup() calls revalidatePath() once the
 * credit lands (so the nav's wallet-balance chip picks it up immediately
 * instead of showing the pre-top-up amount until a manual refresh), and
 * Next.js only allows revalidatePath from a genuine Server Action or Route
 * Handler execution context. A plain page component doesn't qualify, even
 * when the call happens inside an imported "use server" function — that was
 * the earlier version of this file, which is why the previous fix attempt
 * (routing through a Server Action wrapper) still crashed with "revalidatePath
 * ... used during render" instead of fixing the staleness.
 *
 * The redirect query string is never trusted directly — status/amount are
 * re-verified server-side with the secret key before anything is credited.
 * This is a convenience path on top of that boundary, not a second copy of
 * it; the webhook route (api/webhooks/flutterwave) is the durable path if
 * the user closes the tab before this runs.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/wallet", request.url));
  }

  const transactionId = request.nextUrl.searchParams.get("transaction_id");
  const txRef = request.nextUrl.searchParams.get("tx_ref");

  if (!transactionId || !txRef) {
    return errorRedirect(request, "We didn't get a transaction reference back from the payment page.");
  }

  const verified = await verifyFlutterwaveTransaction(transactionId);
  if (!verified.ok) {
    return errorRedirect(request, `Couldn't verify that payment — ${verified.error}`);
  }
  if (verified.status !== "successful" || verified.currency !== "NGN" || verified.txRef !== txRef) {
    return errorRedirect(request, "That payment wasn't successful, so nothing was added to your wallet.");
  }

  const completed = await completeVerifiedWalletTopup({
    reference: verified.txRef,
    amountKobo: verified.amountKobo,
    providerRef: transactionId,
    raw: verified.raw,
  });

  if (!completed.ok) {
    return errorRedirect(request, completed.error);
  }

  return NextResponse.redirect(new URL("/wallet?topup=success", request.url));
}

function errorRedirect(request: NextRequest, reason: string) {
  const url = new URL("/wallet", request.url);
  url.searchParams.set("topup", "error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}
