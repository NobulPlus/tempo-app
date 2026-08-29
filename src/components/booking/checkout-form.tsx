"use client";

import { useActionState, useState } from "react";
import { createBookingAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { CheckIcon, PhoneIcon, LightningIcon } from "@/components/icons";
import { OptionRow } from "@/components/ui/option-row";

const initial: ActionState = {};

/**
 * Payment method choice matters more in Nigeria than most checkout guides
 * assume — a large share of players will never use a card. Bank transfer and
 * USSD are first-class options here, not an afterthought.
 */
const METHODS = [
  {
    key: "transfer",
    label: "Bank transfer",
    hint: "Pay from your banking app. Confirms in seconds.",
    Icon: CheckIcon,
  },
  {
    key: "card",
    label: "Debit card",
    hint: "Verve, Mastercard or Visa via Paystack.",
    Icon: LightningIcon,
  },
  {
    key: "ussd",
    label: "USSD",
    hint: "Dial a short code from any phone. No data needed.",
    Icon: PhoneIcon,
  },
] as const;

export function CheckoutForm({
  slotId,
  totalKobo,
}: {
  slotId: string;
  totalKobo: number;
}) {
  const [state, action, pending] = useActionState(createBookingAction, initial);
  const [method, setMethod] = useState<string>("transfer");

  return (
    <form action={action} className="card-t p-6 md:p-7">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="method" value={method} />

      <h2 className="text-[18px] font-bold">How do you want to pay?</h2>

      <div className="mt-4 grid gap-2.5">
        {METHODS.map(({ key, label, hint, Icon }) => (
          <OptionRow
            key={key}
            selected={method === key}
            onClick={() => setMethod(key)}
            icon={<Icon size={19} />}
            label={label}
            hint={hint}
          />
        ))}
      </div>

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

      <button type="submit" disabled={pending} className="btn-t btn-green-t mt-5 w-full">
        {pending ? "Confirming…" : `Pay ${formatNaira(totalKobo)}`}
      </button>

      <p className="mt-3 text-center text-[12px] text-ink-muted">
        No payment gateway is connected yet — your booking is confirmed without a
        real charge.
      </p>
    </form>
  );
}
