"use client";

import { useActionState } from "react";
import { joinLaunchNotifyListAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { CheckIcon, MailIcon } from "@/components/icons";

const initial: ActionState = {};

export function LaunchNotifyForm() {
  const [state, formAction, pending] = useActionState(joinLaunchNotifyListAction, initial);
  useActionToast(state, { skipSuccess: true });

  if (state.ok) {
    return (
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-green/30 bg-green/10 px-5 py-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/20 text-green">
          <CheckIcon size={18} />
        </span>
        <p className="text-[14.5px] text-ink">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-lg">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
            <MailIcon size={17} />
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@email.com"
            aria-label="Email address"
            autoComplete="email"
            className="w-full rounded-full border border-glass-border bg-glass py-3.5 pl-11 pr-5 text-[14.5px] outline-none transition focus:border-green/50"
            suppressHydrationWarning
          />
        </div>
        <button type="submit" disabled={pending} className="btn-t btn-green-t glow-brand shrink-0 !py-3.5">
          {pending ? "Saving…" : "Notify me"}
        </button>
      </div>
      {state.ok === false && <p className="mt-2 text-[12px] text-orange">{state.error}</p>}
    </form>
  );
}
