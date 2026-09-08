"use client";

import { useContext, useEffect, useRef } from "react";
import { ToastContext } from "./toast-provider";

interface ToastableState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Surfaces a useActionState result as a flash toast instead of an inline
 * banner. Keyed on object identity — useActionState only returns a new
 * object once an action actually completes, so this fires exactly once per
 * submission and never on the initial `{}` state.
 *
 * Pass `{ skipSuccess: true }` for forms that already replace themselves
 * with a persistent inline confirmation on success (e.g. "check your
 * email") — the toast would otherwise duplicate it. Errors still toast,
 * since those forms stay on screen for a retry.
 */
export function useActionToast(state: ToastableState, opts?: { skipSuccess?: boolean }) {
  const ctx = useContext(ToastContext);
  const seen = useRef<ToastableState | null>(null);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (!ctx) return;
    // AUTH_REQUIRED is an internal sentinel (src/app/actions.ts) meaning
    // "redirect to login", never user-facing text — never toast it.
    if (state.error && state.error !== "AUTH_REQUIRED") ctx.push("error", state.error);
    else if (state.message && !opts?.skipSuccess) ctx.push("success", state.message);
  }, [state, ctx, opts?.skipSuccess]);
}
