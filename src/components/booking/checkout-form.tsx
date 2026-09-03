"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBookingAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { WalletIcon } from "@/components/icons";

const initial: ActionState = {};

export function CheckoutForm({
  slotId,
  totalKobo,
  walletBalanceKobo,
}: {
  slotId: string;
  totalKobo: number;
  walletBalanceKobo: number;
}) {
  const [state, action, pending] = useActionState(createBookingAction, initial);
  const canAfford = walletBalanceKobo >= totalKobo;
  const shortfallKobo = totalKobo - walletBalanceKobo;

  return (
    <form action={action} className="card-t p-6 md:p-7">
      <input type="hidden" name="slotId" value={slotId} />

      <h2 className="text-[18px] font-bold">Pay from your wallet</h2>

      <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/4 p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green/18 text-green">
          <WalletIcon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-muted">Wallet balance</div>
          <div className="text-[16px] font-bold">{formatNaira(walletBalanceKobo)}</div>
        </div>
      </div>

      {!canAfford && (
        <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-[13.5px] text-gold">
          You&apos;re {formatNaira(shortfallKobo)} short. Top up to complete this booking.
        </p>
      )}

      <label className="mt-5 flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-soft">
        <input
          type="checkbox"
          required
          name="agree"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#00e676]"
        />
        <span>
          I understand the cancellation policy and agree to Tempo&apos;s{" "}
          <a href="/legal/terms" className="text-green underline underline-offset-2">
            Terms
          </a>
          .
        </span>
      </label>

      {state.error && state.error !== "AUTH_REQUIRED" && (
        <p role="alert" className="mt-4 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
          {state.error}
        </p>
      )}

      {canAfford ? (
        <button type="submit" disabled={pending} className="btn-t btn-green-t mt-5 w-full">
          {pending ? "Confirming…" : `Pay ${formatNaira(totalKobo)}`}
        </button>
      ) : (
        <Link href="/wallet" className="btn-t btn-green-t mt-5 w-full">
          Top up wallet
        </Link>
      )}

      <p className="mt-3 text-center text-[12px] text-ink-muted">
        Cancel 6+ hours before kickoff and this is credited straight back to your wallet.
      </p>
    </form>
  );
}
