"use client";

import { useActionState } from "react";
import { joinPartnerWaitlist, type ActionState } from "@/app/actions";
import { CheckIcon, MailIcon, PinIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function PartnerForm() {
  const [state, formAction, pending] = useActionState(joinPartnerWaitlist, initial);
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
    <form action={formAction} className="mx-auto max-w-xl text-left">
      <div className="grid gap-4">
        <label>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Email or phone
          </span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
              <MailIcon size={17} />
            </span>
            <input
              name="contact"
              required
              placeholder="you@example.com or 0801 234 5678"
              aria-label="Email address or phone number"
              autoComplete="email"
              className="input-t pl-11"
              suppressHydrationWarning
            />
          </span>
        </label>

        <label>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Venue area
          </span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
              <PinIcon size={16} />
            </span>
            <input
              name="area"
              required
              placeholder="Lekki, Surulere, Yaba..."
              aria-label="Venue area"
              className="input-t pl-11"
            />
          </span>
        </label>

        <button type="submit" disabled={pending} className="btn-t btn-green-t w-full !py-3.5">
          {pending ? "Sending…" : "List my venue"}
        </button>
      </div>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-muted">
        No commitment — we&apos;ll reach out to arrange a visit before anything goes live.
      </p>
    </form>
  );
}
