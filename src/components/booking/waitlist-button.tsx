"use client";

import { useActionState, useState } from "react";
import { toggleBookingWaitlistAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function WaitlistButton({ slotId, initiallyOn }: { slotId: string; initiallyOn: boolean }) {
  const [state, formAction, pending] = useActionState(toggleBookingWaitlistAction, initial);
  useActionToast(state, { skipSuccess: true });
  const [on, setOn] = useState(initiallyOn);

  return (
    <form action={formAction}>
      <input type="hidden" name="slotId" value={slotId} />
      <button
        type="submit"
        disabled={pending}
        onClick={() => setOn((v) => !v)}
        className="btn-t btn-ghost-t mt-4 w-full !py-2.5 !text-[13.5px]"
      >
        {pending ? "…" : on ? "Leave waitlist" : "Notify me if this opens up"}
      </button>
    </form>
  );
}
