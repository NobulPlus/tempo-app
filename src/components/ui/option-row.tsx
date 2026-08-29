"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

/**
 * The "bordered selectable row" pattern — was hand-rolled separately in
 * HostForm's slot picker, HostForm's level picker, and CheckoutForm's
 * payment-method picker, each with slightly different selected-state
 * treatment. One component now, one selected-state language everywhere.
 */
export function OptionRow({
  selected,
  onClick,
  icon,
  label,
  hint,
  value,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  /** Leading icon badge. Omit for a plain text row (e.g. a level picker). */
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  /** Right-aligned secondary value, shown before the check circle (e.g. a price). */
  value?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition ${
        selected
          ? "glow-brand border-green/50 bg-green/10"
          : "border-white/10 bg-white/4 hover:border-white/25"
      } ${className}`}
    >
      {icon && (
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
            selected ? "bg-green/18 text-green" : "bg-white/6 text-ink-soft"
          }`}
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[14.5px] font-semibold transition-colors ${
            selected && !icon ? "text-green" : ""
          }`}
        >
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-[12px] leading-snug text-ink-muted">{hint}</span>
        )}
      </span>

      {value && <span className="shrink-0 text-[14px] font-bold">{value}</span>}

      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-all duration-200 ${
          selected ? "border-green bg-green text-[#04150c]" : "scale-90 border-white/25 opacity-60"
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
