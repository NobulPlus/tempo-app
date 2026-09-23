"use client";

import { useActionState } from "react";
import { acceptBookingTransferAction, cancelBookingTransferOfferAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function AcceptTransferForm({ offerId }: { offerId: string }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptBookingTransferAction, initial);
  const [declineState, declineAction, declinePending] = useActionState(cancelBookingTransferOfferAction, initial);
  useActionToast(acceptState);
  useActionToast(declineState, { skipSuccess: true });

  if (declineState.ok) {
    return <p className="mt-5 text-[13.5px] text-ink-soft">Declined.</p>;
  }

  return (
    <div className="mt-5 flex justify-center gap-3">
      <form action={acceptAction}>
        <input type="hidden" name="offerId" value={offerId} />
        <button type="submit" disabled={acceptPending || declinePending} className="btn-t btn-green-t">
          {acceptPending ? "Accepting…" : "Accept & pay"}
        </button>
      </form>
      <form action={declineAction}>
        <input type="hidden" name="offerId" value={offerId} />
        <button type="submit" disabled={acceptPending || declinePending} className="btn-t btn-ghost-t">
          {declinePending ? "…" : "Decline"}
        </button>
      </form>
      {acceptState.ok === false && <p className="mt-2 text-[12px] text-orange">{acceptState.error}</p>}
    </div>
  );
}
