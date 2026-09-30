"use client";

import { useActionState, useState } from "react";
import { togglePitchAvailabilityScheduleAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function AvailabilityScheduleToggle({ pitchId, initiallyEnabled }: { pitchId: string; initiallyEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(togglePitchAvailabilityScheduleAction, initial);
  useActionToast(state, { skipSuccess: true });
  const [enabled, setEnabled] = useState(initiallyEnabled);

  return (
    <form
      action={formAction}
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[13px] ${
        enabled ? "border-green/25 bg-green/8 text-green" : "border-orange/25 bg-orange/8 text-orange"
      }`}
    >
      <input type="hidden" name="pitchId" value={pitchId} />
      <div>
        <div className="font-bold">{enabled ? "Auto-refill is on" : "Auto-refill is paused"}</div>
        <div className="mt-0.5 text-[12px] opacity-85">
          {enabled
            ? "These saved rules automatically extend this pitch's bookable calendar."
            : "New slots won't be generated automatically. Existing bookable slots stay untouched."}
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        onClick={() => setEnabled((v) => !v)}
        className="btn-t btn-ghost-t shrink-0 !py-2 !text-[12.5px]"
      >
        {pending ? "…" : enabled ? "Pause" : "Resume"}
      </button>
    </form>
  );
}
