"use client";

import { useActionState } from "react";
import Image from "next/image";
import { createBookingAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { ShieldIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";

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
  useActionToast(state);
  const canUseCredit = walletBalanceKobo >= totalKobo;

  return (
    <form action={action} className="card-t p-6 md:p-7">
      <input type="hidden" name="slotId" value={slotId} />

      <h2 className="text-[18px] font-bold">Pay to reserve this pitch</h2>

      <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/4 p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green/18 text-green">
          <ShieldIcon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-muted">Amount due now</div>
          <div className="text-[16px] font-bold">{formatNaira(totalKobo)}</div>
        </div>
      </div>

      {walletBalanceKobo > 0 && (
        <p className="mt-4 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-[13.5px] text-ink-soft">
          You have {formatNaira(walletBalanceKobo)} in Tempo credit.
          {!canUseCredit && " It can only be used when it covers the full amount."}
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-semibold text-ink-soft">Payment channel</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <PaymentOption value="korapay" label="KoraPay" logo="/payments/korapay.png" defaultChecked />
          <PaymentOption value="flutterwave" label="Flutterwave" logo="/payments/flutterwave.png" />
          {canUseCredit && (
            <PaymentOption
              value="wallet"
              label="Tempo credit"
              hint={`${formatNaira(walletBalanceKobo)} available`}
            />
          )}
        </div>
      </fieldset>

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

      <button type="submit" disabled={pending} className="btn-t btn-green-t mt-5 w-full">
        {pending ? "Opening checkout..." : `Pay ${formatNaira(totalKobo)}`}
      </button>

      <p className="mt-3 text-center text-[12px] text-ink-muted">
        Cancel 6+ hours before kickoff and the value is credited back to your Tempo credit ledger.
      </p>
    </form>
  );
}

function PaymentOption({
  value,
  label,
  logo,
  hint,
  defaultChecked,
}: {
  value: "korapay" | "flutterwave" | "wallet";
  label: string;
  logo?: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-[78px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/4 p-3 text-[13.5px] font-semibold transition has-[:checked]:border-green/45 has-[:checked]:bg-green/10">
      <span className="min-w-0 flex-1">
        {logo ? (
          <span className="flex h-12 w-full items-center justify-center rounded-lg bg-white px-3 shadow-[inset_0_0_0_1px_rgba(10,20,35,0.06)]">
            <Image
              src={logo}
              alt={label}
              width={190}
              height={44}
              className={`w-full object-contain ${value === "flutterwave" ? "max-h-6" : "max-h-9"}`}
            />
          </span>
        ) : (
          <span>{label}</span>
        )}
        {hint && <span className="mt-0.5 block text-[11px] font-normal text-ink-muted">{hint}</span>}
      </span>
      <input type="radio" name="provider" value={value} defaultChecked={defaultChecked} className="h-4 w-4 accent-[#00e676]" />
    </label>
  );
}
