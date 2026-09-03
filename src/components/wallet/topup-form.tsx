"use client";

import { useActionState, useState } from "react";
import { initiateWalletTopupAction, type ActionState } from "@/app/actions";
import { OptionRow } from "@/components/ui/option-row";
import { WalletIcon } from "@/components/icons";

const initial: ActionState = {};

const PRESETS = [10_000, 15_000, 20_000, 30_000];

export function TopupForm() {
  const [state, action, pending] = useActionState(initiateWalletTopupAction, initial);
  const [amount, setAmount] = useState<number | "custom">(PRESETS[0]);
  const [customAmount, setCustomAmount] = useState("");

  const amountNaira = amount === "custom" ? Number(customAmount) || 0 : amount;

  return (
    <form action={action} className="card-t p-6 md:p-7">
      <h2 className="flex items-center gap-2 text-[18px] font-bold">
        <WalletIcon size={18} className="text-green" />
        Top up your wallet
      </h2>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">
        Choose an amount, or enter your own. Funds land instantly and never expire.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {PRESETS.map((naira) => (
          <OptionRow
            key={naira}
            selected={amount === naira}
            onClick={() => setAmount(naira)}
            label={`₦${naira.toLocaleString()}`}
          />
        ))}
      </div>

      <div className="mt-2.5">
        <OptionRow
          selected={amount === "custom"}
          onClick={() => setAmount("custom")}
          label="Custom amount"
          hint={amount === "custom" ? undefined : "Enter any amount from ₦500 to ₦500,000"}
        />
        {amount === "custom" && (
          <div className="field-t mt-2.5">
            <input
              id="customAmount"
              type="number"
              min={500}
              max={500_000}
              step={1}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder=" "
              autoFocus
            />
            <label htmlFor="customAmount" className="floating">
              Amount in naira
            </label>
          </div>
        )}
      </div>

      <input type="hidden" name="amountNaira" value={amountNaira} />

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || amountNaira < 500}
        className="btn-t btn-green-t mt-5 w-full"
      >
        {pending ? "Starting…" : `Top up ₦${amountNaira.toLocaleString()}`}
      </button>
    </form>
  );
}
