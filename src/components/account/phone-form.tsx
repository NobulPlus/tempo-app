"use client";

import { useActionState } from "react";
import { updatePhoneAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { PhoneIcon } from "@/components/icons";

const initial: ActionState = {};

export function PhoneForm({ phone }: { phone: string | null }) {
  const [state, formAction, pending] = useActionState(updatePhoneAction, initial);
  useActionToast(state, { skipSuccess: true });

  return (
    <form action={formAction} className="card-t p-6">
      <h2 className="flex items-center gap-2 text-[16px] font-bold">
        <PhoneIcon size={16} className="text-green" />
        Phone number
      </h2>
      <p className="mt-1 text-[12.5px] text-ink-soft">
        Private — never shown to other players. Used for account recovery and important updates.
      </p>

      <input
        name="phone"
        type="tel"
        defaultValue={phone ?? ""}
        placeholder="e.g. 0801 234 5678"
        className="mt-4 w-full rounded-xl border border-glass-border bg-glass px-3.5 py-2.5 text-[14px] outline-none transition focus:border-green/50"
      />

      <button type="submit" disabled={pending} className="btn-t btn-ghost-t mt-4 !py-2.5 !text-[13.5px]">
        {pending ? "Saving…" : phone ? "Update" : "Add phone number"}
      </button>
      {state.ok === false && <p className="mt-2 text-[12px] text-orange">{state.error}</p>}
    </form>
  );
}
