"use client";

import { useActionState, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  joinGameAction,
  leaveGameAction,
  payGameBalanceAction,
  cancelGameAction,
  createGameSlotTransferOfferAction,
  type ActionState,
} from "@/app/actions";
import { formatNaira, formatDayShort, formatTime } from "@/lib/format";
import { CheckIcon, CloseIcon, ClockIcon } from "@/components/icons";
import { ToastContext } from "@/components/toast/toast-provider";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function JoinButton({
  gameId,
  slug,
  priceKobo,
  isMember,
  isWaitlisted,
  isPendingPayment,
  paidKobo,
  paymentDeadline,
  isHost,
  isCancelled,
  refundCount,
  refundKobo,
  spotsLeft,
  signedIn,
  hasEnded,
}: {
  gameId: string;
  slug: string;
  priceKobo: number;
  isMember: boolean;
  isWaitlisted: boolean;
  isPendingPayment: boolean;
  paidKobo: number;
  paymentDeadline: string | null;
  isHost: boolean;
  isCancelled: boolean;
  refundCount: number;
  refundKobo: number;
  spotsLeft: number;
  signedIn: boolean;
  hasEnded: boolean;
}) {
  const router = useRouter();
  const toast = useContext(ToastContext);
  const [pending, start] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelGameAction, initial);
  useActionToast(cancelState);

  if (isCancelled) {
    return (
      <p className="rounded-full border border-white/10 bg-white/4 px-5 py-3.5 text-center text-[14px] text-ink-soft">
        This game was cancelled.
      </p>
    );
  }

  if (hasEnded) {
    return (
      <button disabled className="btn-t btn-ghost-t w-full">
        This game has finished
      </button>
    );
  }

  if (!signedIn) {
    return (
      <a href={`/login?next=${encodeURIComponent(`/games/${slug}`)}`} className="btn-t btn-green-t w-full">
        Sign in to join
      </a>
    );
  }

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) => {
    start(async () => {
      const res = await fn();
      if (res.error === "AUTH_REQUIRED") {
        router.push(`/login?next=${encodeURIComponent(`/games/${slug}`)}`);
        return;
      }
      if (res.error) toast?.push("error", res.error);
      else if (res.message) toast?.push("success", res.message);
      router.refresh();
    });
  };

  if (isHost) {
    return (
      <div>
        <div className="flex items-center justify-center gap-2 rounded-full border border-green/35 bg-green/12 px-5 py-3.5 text-[15px] font-semibold text-green">
          <CheckIcon size={17} />
          You&apos;re hosting this game
        </div>

        {!confirmingCancel ? (
          <button
            type="button"
            onClick={() => setConfirmingCancel(true)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-[13.5px] font-semibold text-ink-muted transition hover:text-orange"
          >
            <CloseIcon size={13} />
            Cancel this game
          </button>
        ) : (
          <form action={cancelAction} className="mt-3 rounded-xl border border-orange/25 bg-orange/6 p-4 text-center">
            <input type="hidden" name="gameId" value={gameId} />
            <input type="hidden" name="slug" value={slug} />
            <p className="text-[13.5px] text-ink-soft">
              {refundCount > 0
                ? `${refundCount} player${refundCount === 1 ? "" : "s"} will be refunded ${formatNaira(refundKobo)} total.`
                : "No players have paid in yet — nothing to refund."}
            </p>
            <div className="mt-3 flex justify-center gap-2.5">
              <button
                type="submit"
                disabled={cancelPending}
                className="btn-t btn-ghost-t !border-orange/40 !text-orange"
              >
                {cancelPending ? "Cancelling…" : "Confirm cancellation"}
              </button>
              <button type="button" onClick={() => setConfirmingCancel(false)} className="btn-t btn-ghost-t">
                Never mind
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      {isPendingPayment ? (
        <>
          <div className="rounded-xl border border-gold/35 bg-gold/12 px-4 py-3.5 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[14px] font-semibold text-gold">
              <ClockIcon size={15} />
              {formatNaira(priceKobo - paidKobo)} still due
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              {paidKobo > 0 ? `You've paid ${formatNaira(paidKobo)} of ${formatNaira(priceKobo)}. ` : ""}
              {paymentDeadline
                ? `Complete it by ${formatDayShort(paymentDeadline)}, ${formatTime(paymentDeadline)} to keep your spot.`
                : "Complete it soon to keep your spot."}
            </p>
          </div>
          <button
            onClick={() => run(() => payGameBalanceAction(gameId, slug))}
            disabled={pending}
            className="btn-t btn-green-t mt-2.5 w-full"
          >
            {pending ? "Charging wallet…" : `Complete payment — ${formatNaira(priceKobo - paidKobo)}`}
          </button>
          <button
            onClick={() => run(() => leaveGameAction(gameId, slug))}
            disabled={pending}
            className="mt-2.5 w-full text-[13.5px] text-ink-muted underline underline-offset-4 transition hover:text-orange"
          >
            {pending ? "Updating…" : "Can't make it? Drop out"}
          </button>
        </>
      ) : isMember ? (
        <>
          <div className="flex items-center justify-center gap-2 rounded-full border border-green/35 bg-green/12 px-5 py-3.5 text-[15px] font-semibold text-green">
            <CheckIcon size={17} />
            {isWaitlisted ? "You're on the waitlist" : "You're in this game"}
          </div>
          <button
            onClick={() => run(() => leaveGameAction(gameId, slug))}
            disabled={pending}
            className="mt-2.5 w-full text-[13.5px] text-ink-muted underline underline-offset-4 transition hover:text-orange"
          >
            {pending ? "Updating…" : "Can't make it? Drop out"}
          </button>
          {!isWaitlisted && (
            <button
              onClick={() => run(() => createGameSlotTransferOfferAction(gameId, slug))}
              disabled={pending}
              className="mt-2 w-full text-[13.5px] text-ink-muted underline underline-offset-4 transition hover:text-green"
            >
              {pending ? "Creating transfer…" : "Create transfer code"}
            </button>
          )}
        </>
      ) : (
        <button
          onClick={() => run(() => joinGameAction(gameId, slug, priceKobo))}
          disabled={pending}
          className={`btn-t w-full ${spotsLeft === 0 ? "btn-ghost-t" : "btn-green-t"}`}
        >
          {pending
            ? "Joining…"
            : spotsLeft === 0
              ? "Join the waitlist"
              : `Join game — ${formatNaira(priceKobo)}`}
        </button>
      )}
    </div>
  );
}
