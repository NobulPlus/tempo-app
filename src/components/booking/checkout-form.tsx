"use client";

import { useActionState, useState } from "react";
import { createBookingAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { CheckIcon, PhoneIcon, LightningIcon } from "@/components/icons";

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
          <button
            type="button"
            key={key}
            onClick={() => setMethod(key)}
            aria-pressed={method === key}
            className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition ${
              method === key
                ? "border-green/50 bg-green/10"
                : "border-white/10 bg-white/4 hover:border-white/25"
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                method === key ? "bg-green/18 text-green" : "bg-white/6 text-ink-soft"
              }`}
            >
              <Icon size={19} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{label}</span>
              <span className="block text-[12.5px] text-ink-muted">{hint}</span>
            </span>
            <span
              className={`ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                method === key ? "border-green bg-green text-[#04150c]" : "border-white/25"
              }`}
            >
              {method === key && <CheckIcon size={12} />}
            </span>
          </button>
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
        Demo mode — no money moves. Wire your Paystack keys to take real payments.
      </p>
    </form>
  );
}
