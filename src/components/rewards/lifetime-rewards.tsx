"use client";

import { useActionState } from "react";
import { CheckIcon, LockIcon, StarIcon } from "@/components/icons";
import { claimLifetimeRewardAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

const MILESTONES = [
  { points: 1000, label: "₦10,000 Tempo credit", sub: "One-time lifetime milestone" },
  { points: 3000, label: "₦30,000 Tempo credit", sub: "One-time lifetime milestone" },
] as const;

export function LifetimeRewards({
  lifetimePoints,
  claimedMilestones,
  loggedIn,
}: {
  lifetimePoints: number;
  claimedMilestones: number[];
  loggedIn: boolean;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-[15px] font-bold">
        <StarIcon size={16} className="text-gold" />
        Lifetime milestones
      </h3>
      <p className="mt-1 text-[12.5px] text-ink-muted">Your lifetime points never expire or reduce when you claim.</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {MILESTONES.map((milestone) => (
          <LifetimeMilestone
            key={milestone.points}
            {...milestone}
            unlocked={lifetimePoints >= milestone.points}
            claimed={claimedMilestones.includes(milestone.points)}
            loggedIn={loggedIn}
          />
        ))}
      </div>
    </div>
  );
}

function LifetimeMilestone({
  points,
  label,
  sub,
  unlocked,
  claimed,
  loggedIn,
}: {
  points: number;
  label: string;
  sub: string;
  unlocked: boolean;
  claimed: boolean;
  loggedIn: boolean;
}) {
  const [state, action, pending] = useActionState(claimLifetimeRewardAction, initial);
  useActionToast(state);
  const complete = claimed || state.ok === true;

  return (
    <div className={`rounded-xl border p-4 ${complete || unlocked ? "border-gold/35 bg-gold/8" : "border-glass-border bg-glass"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            {complete ? <CheckIcon size={13} className="text-green" /> : <LockIcon size={12} />}
            {points.toLocaleString()} lifetime pts
          </div>
          <div className="mt-1 text-[14px] font-semibold">{label}</div>
          <div className="mt-0.5 text-[12px] text-ink-muted">{sub}</div>
        </div>
        {loggedIn && !complete && (
          <form action={action}>
            <input type="hidden" name="milestone" value={points} />
            <button type="submit" disabled={!unlocked || pending} className="btn-t btn-ghost-t shrink-0 !px-3 !py-2 !text-[12px]">
              {pending ? "…" : unlocked ? "Claim" : `${points.toLocaleString()} pts`}
            </button>
          </form>
        )}
      </div>
      {complete && <div className="mt-3 text-[12px] font-semibold text-green">Added to your Tempo credit</div>}
    </div>
  );
}
