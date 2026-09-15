"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon, CheckIcon } from "@/components/icons";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * The one dropdown component every form should use. A native <select>'s
 * closed state can be themed, but its open options panel is rendered by the
 * OS — always light, never matching the app — so this rebuilds it as a real
 * listbox instead. Still participates in a native form submission via a
 * hidden input (name/value), and respects a native form.reset() the same
 * way a real <select> would, since several forms in this app reset() on
 * success and expect every field to clear with it.
 */
export function Select({
  name,
  defaultValue,
  options,
  label,
  hint,
  placeholder = "Select…",
  disabled,
  className = "",
  onChange,
}: {
  name?: string;
  defaultValue?: string;
  options: SelectOption[];
  label?: string;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const initial = defaultValue ?? "";
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setValue(initial);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const pick = (v: string) => {
    setValue(v);
    onChange?.(v);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          {label}
        </label>
      )}
      {name && <input ref={inputRef} type="hidden" name={name} value={value} readOnly />}

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-glass-border bg-glass px-4 py-3.5 text-left text-[15px] outline-none transition focus:border-green/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${selected ? "" : "text-ink-muted"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon
          size={16}
          className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={label ? id : undefined}
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-glass-border bg-bg-elevated p-1.5 shadow-xl"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[14px] transition ${
                  o.value === value ? "bg-green/12 text-green" : "text-ink hover:bg-white/6"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <CheckIcon size={14} className="shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hint && <span className="mt-1.5 block text-[12px] text-ink-muted">{hint}</span>}
    </div>
  );
}
