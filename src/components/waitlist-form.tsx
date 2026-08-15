"use client";

import { useActionState } from "react";
import { joinWaitlist, type ActionState } from "@/app/actions";
import { CheckIcon, MailIcon } from "@/components/icons";

const initial: ActionState = {};

export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, initial);

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
    <form action={action} className="mx-auto max-w-lg">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
            <MailIcon size={17} />
          </span>
          <input
            name="contact"
            required
            placeholder="Email or 0801 234 5678"
            aria-label="Email address or phone number"
            autoComplete="email"
            className="w-full rounded-full border border-white/12 bg-white/5 py-3.5 pl-11 pr-4 text-[14.5px] outline-none transition focus:border-green/50"
          />
        </div>
        <input
          name="area"
          placeholder="Where do you play?"
          aria-label="Your area"
          className="rounded-full border border-white/12 bg-white/5 px-5 py-3.5 text-[14.5px] outline-none transition focus:border-green/50 sm:w-44"
        />
        <button type="submit" disabled={pending} className="btn-t btn-green-t !py-3.5">
          {pending ? "Adding…" : "Notify me"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-[13.5px] text-orange">
          {state.error}
        </p>
      )}
      <p className="mt-3 text-[12px] text-ink-muted">
        We&apos;ll only message you about pitches in your area. Unsubscribe anytime.
      </p>
    </form>
  );
}
