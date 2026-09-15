"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailIcon, CheckIcon } from "@/components/icons";
import { requestPasswordResetAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initial);
  useActionToast(state, { skipSuccess: true });

  if (state.ok) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green/30 bg-green/10 px-5 py-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/20 text-green">
          <CheckIcon size={18} />
        </span>
        <p className="text-[14.5px] text-ink">{state.message}</p>
      </div>
    );
  }

  return (
    <form className="space-y-4" action={formAction}>
      <div className="field-t">
        <input id="email" name="email" type="email" required autoComplete="email" placeholder=" " suppressHydrationWarning />
        <span className="field-icon">
          <MailIcon size={19} />
        </span>
        <label htmlFor="email" className="floating">
          Email
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <Link
        href="/login"
        className="block text-center text-[13.5px] text-ink-soft transition hover:text-green"
      >
        Back to sign in
      </Link>
    </form>
  );
}
