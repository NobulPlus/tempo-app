"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { initiateWalletTopupAction, type ActionState } from "@/app/actions";
import { OptionRow } from "@/components/ui/option-row";
import { CheckIcon, WalletIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

const PRESETS = [10_000, 15_000, 20_000, 30_000];
type PaymentProvider = "korapay" | "flutterwave";

export function TopupForm({ providers }: { providers: Record<PaymentProvider, boolean> }) {
  const [state, action, pending] = useActionState(initiateWalletTopupAction, initial);
  useActionToast(state);
  const [amount, setAmount] = useState<number | "custom">(PRESETS[0]);
  const [customAmount, setCustomAmount] = useState("");
  const availableProviders = (Object.entries(providers) as [PaymentProvider, boolean][])
    .filter(([, configured]) => configured)
    .map(([provider]) => provider);
  const [provider, setProvider] = useState<PaymentProvider>(availableProviders[0] ?? "korapay");
  const hasProvider = availableProviders.length > 0;

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

      {availableProviders.length > 1 && (
        <div className="mt-5">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Payment channel
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <PaymentProviderOption
              provider="korapay"
              selected={provider === "korapay"}
              onClick={() => setProvider("korapay")}
            />
            <PaymentProviderOption
              provider="flutterwave"
              selected={provider === "flutterwave"}
              onClick={() => setProvider("flutterwave")}
            />
          </div>
        </div>
      )}

      {!hasProvider && (
        <p className="mt-5 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
          No payment channel is configured yet.
        </p>
      )}

      <input type="hidden" name="amountNaira" value={amountNaira} />
      <input type="hidden" name="provider" value={provider} />

      <button
        type="submit"
        disabled={pending || amountNaira < 500 || !hasProvider}
        className="btn-t btn-green-t mt-5 w-full"
      >
        {pending ? "Starting…" : `Top up ₦${amountNaira.toLocaleString()}`}
      </button>
    </form>
  );
}

function PaymentProviderOption({
  provider,
  selected,
  onClick,
}: {
  provider: PaymentProvider;
  selected: boolean;
  onClick: () => void;
}) {
  const label = provider === "korapay" ? "Korapay" : "Flutterwave";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Pay with ${label}`}
      className={`relative grid h-[86px] w-full place-items-center overflow-hidden rounded-xl border p-3 transition ${
        selected
          ? "glow-brand border-blue-400/70 bg-blue-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/6"
      }`}
    >
      <span
        className={`absolute inset-0 opacity-0 transition-opacity ${
          selected ? "opacity-100" : ""
        } bg-[radial-gradient(circle_at_50%_0%,rgba(80,145,255,0.24),transparent_62%)]`}
      />
      <span className="relative grid h-full w-full place-items-center overflow-hidden rounded-lg bg-white px-4 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.16)]">
        <Image
          src={`/payments/${provider}.webp`}
          alt=""
          fill
          sizes="220px"
          className="object-contain p-2"
          aria-hidden="true"
        />
      </span>
      <span
        className={`absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full border transition-all duration-200 ${
          selected
            ? "scale-100 border-blue-300 bg-blue-500 text-white opacity-100"
            : "scale-90 border-white/25 bg-black/10 text-transparent opacity-50"
        }`}
      >
        <CheckIcon
          size={11}
          className={`transition-transform duration-200 ${selected ? "scale-100" : "scale-0"}`}
        />
      </span>
    </button>
  );
}
