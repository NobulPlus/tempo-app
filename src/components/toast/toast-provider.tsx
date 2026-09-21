"use client";

import { createContext, useCallback, useMemo, useRef, useState } from "react";
import { AlertIcon, CheckIcon, CloseIcon } from "@/components/icons";

export type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; text: string };

const DURATION_MS: Record<ToastKind, number> = { success: 5000, error: 8000 };

export const ToastContext = createContext<{ push: (kind: ToastKind, text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = ++nextId.current;
      setToasts((prev) => [...prev, { id, kind, text }]);
      setTimeout(() => dismiss(id), DURATION_MS[kind]);
    },
    [dismiss],
  );

  // A fresh {push} object literal on every render would give every consumer
  // a "changed" context value even though push itself is stable — any
  // effect depending on this context (e.g. LoginFlashMessage) would then
  // re-fire every time ToastProvider re-renders, which includes every time
  // a toast is pushed. That's exactly how this caused an infinite loop:
  // push -> re-render -> new context object -> effect re-fires -> push again.
  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(71px+12px)] z-[1200] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} kind={t.kind} text={t.text} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ kind, text, onClose }: { kind: ToastKind; text: string; onClose: () => void }) {
  const isError = kind === "error";
  return (
    <div
      role="alert"
      className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md ${
        isError ? "border-red/30 bg-red/10 text-red" : "border-green/30 bg-green/10 text-green"
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {isError ? <AlertIcon size={18} /> : <CheckIcon size={18} />}
      </span>
      <p className="flex-1 text-[13.5px] font-medium leading-snug">{text}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
      >
        <CloseIcon size={15} />
      </button>
    </div>
  );
}
