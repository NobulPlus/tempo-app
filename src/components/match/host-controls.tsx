"use client";

import { useActionState, useEffect, useState } from "react";
import { decideGameMinimumAction, settleGameHostReimbursementAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { ShieldIcon, CheckIcon, WalletIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

/**
 * Replaces the plain "X more players needed" text with a real decision
 * once the minimum-decision deadline passes — only the host (or admin) can
 * act on it; everyone else just sees who's waiting on what.
 */
export function MinimumDecisionBanner({
  gameId,
  slug,
  isHost,
  spotsNeeded,
  minimum,
  deadline,
}: {
  gameId: string;
  slug: string;
  isHost: boolean;
  spotsNeeded: number;
  minimum: number;
  deadline: string | null;
}) {
  const [state, action, pending] = useActionState(decideGameMinimumAction, initial);
  useActionToast(state);

  // Render the "not yet passed" copy on the server, then check the real
  // clock once mounted — avoids a server/client time mismatch, same
  // pattern Countdown uses below.
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  useEffect(() => {
    if (!deadline) return;
    const delay = Math.min(Math.max(0, new Date(deadline).getTime() - Date.now()), 2_147_483_647);
    const id = window.setTimeout(() => setDeadlinePassed(true), delay);
    return () => window.clearTimeout(id);
  }, [deadline]);

  if (!deadlinePassed) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/8 px-3.5 py-2.5 text-[13px] text-gold">
        <ShieldIcon size={14} className="mt-0.5 shrink-0" />
        {spotsNeeded} more {spotsNeeded === 1 ? "player" : "players"} and this game is
        guaranteed. {isHost ? "You'll" : "The host will"} decide whether to go ahead or
        cancel{deadline ? ` by ${new Date(deadline).toLocaleString("en-NG", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}.
      </p>
    );
  }

  if (!isHost) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/8 px-3.5 py-2.5 text-[13px] text-gold">
        <ShieldIcon size={14} className="mt-0.5 shrink-0" />
        This game is below its {minimum}-player minimum. Waiting on the host to decide
        whether it goes ahead.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-gold/25 bg-gold/8 p-3.5">
      <p className="flex items-start gap-2 text-[13px] text-gold">
        <ShieldIcon size={14} className="mt-0.5 shrink-0" />
        Only {minimum - spotsNeeded} of {minimum} minimum joined, and the decision
        deadline has passed. Go ahead anyway, or cancel and refund everyone who&apos;s paid
        in?
      </p>
      <form action={action} className="mt-3 flex flex-wrap gap-2.5">
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="slug" value={slug} />
        <button
          type="submit"
          name="decision"
          value="go_ahead"
          disabled={pending}
          className="btn-t btn-green-t !px-4 !py-2 !text-[13px]"
        >
          {pending ? "Working…" : "Go ahead anyway"}
        </button>
        <button
          type="submit"
          name="decision"
          value="cancel"
          disabled={pending}
          className="btn-t btn-ghost-t !border-orange/40 !px-4 !py-2 !text-[13px] !text-orange"
        >
          {pending ? "Working…" : "Cancel & refund players"}
        </button>
      </form>
    </div>
  );
}

/**
 * As players pay in, that money is Tempo's, not the host's, until it's
 * settled here — capped at what the host originally paid to reserve the
 * pitch. Only shows once the game has ended and the host has actually
 * committed to it (reached minimum, or explicitly chose to go ahead).
 */
export function HostReimbursementCard({
  gameId,
  slug,
  hostPaidKobo,
  hostReimbursedKobo,
}: {
  gameId: string;
  slug: string;
  hostPaidKobo: number;
  hostReimbursedKobo: number;
}) {
  const [state, action, pending] = useActionState(settleGameHostReimbursementAction, initial);
  useActionToast(state);

  const remaining = Math.max(0, hostPaidKobo - hostReimbursedKobo);
  const percent = hostPaidKobo > 0 ? Math.min(100, Math.round((hostReimbursedKobo / hostPaidKobo) * 100)) : 100;

  return (
    <div className="card-t p-6">
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <WalletIcon size={17} className="text-green" />
        Your pitch deposit
      </h3>
      <div className="mt-3 flex items-end justify-between text-[13px]">
        <span className="text-ink-soft">Recovered</span>
        <span className="font-semibold">
          {formatNaira(hostReimbursedKobo)} <span className="text-ink-muted">of {formatNaira(hostPaidKobo)}</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${percent}%` }} />
      </div>

      {remaining <= 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-green">
          <CheckIcon size={13} />
          Fully recovered.
        </p>
      ) : (
        <form action={action} className="mt-3">
          <input type="hidden" name="gameId" value={gameId} />
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" disabled={pending} className="btn-t btn-ghost-t w-full !py-2.5 !text-[13px]">
            {pending ? "Checking…" : "Check for reimbursement"}
          </button>
          <p className="mt-2 text-[11.5px] text-ink-muted">
            Settles after the match ends — you&apos;ll never get back more than
            you paid.
          </p>
        </form>
      )}
    </div>
  );
}
