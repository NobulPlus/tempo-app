"use client";

import { useActionState, useState } from "react";
import { cancelBookingAction, type ActionState } from "@/app/actions";
import { CloseIcon } from "@/components/icons";

const initial: ActionState = {};

export function CancelBookingButton({
  bookingId,
  status,
  eligibleForCredit,
}: {
  bookingId: string;
  /** The booking's status as of the last server render — this component stays
   * mounted across the revalidation a cancellation triggers (same position in
   * the tree, no conditional swap), so `state.message` from the action that
   * just ran survives even once `status` flips to "cancelled". */
  status: "confirmed" | "cancelled";
  eligibleForCredit: boolean;
}) {
  const [state, action, pending] = useActionState(cancelBookingAction, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.ok && state.message) {
    return (
      <p className="mt-6 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-center text-[13.5px] text-green">
        {state.message}
      </p>
    );
  }

  if (status === "cancelled") {
    return (
      <p className="mt-6 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-center text-[13.5px] text-ink-soft">
        This booking has been cancelled.
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-6 flex w-full items-center justify-center gap-1.5 text-[13px] font-semibold text-ink-muted transition hover:text-orange"
      >
        <CloseIcon size={13} />
        Cancel this booking
      </button>
    );
  }

  return (
    <form action={action} className="mt-6 rounded-xl border border-orange/25 bg-orange/6 p-4 text-center">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-[13.5px] text-ink-soft">
        {eligibleForCredit
          ? "You'll get a full credit back to your wallet."
          : "It's inside 6 hours of kickoff, so no credit will be issued."}
      </p>
      {state.error && <p className="mt-2 text-[13px] text-orange">{state.error}</p>}
      <div className="mt-3 flex justify-center gap-2.5">
        <button type="submit" disabled={pending} className="btn-t btn-ghost-t !border-orange/40 !text-orange">
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="btn-t btn-ghost-t"
        >
          Never mind
        </button>
      </div>
    </form>
  );
}
