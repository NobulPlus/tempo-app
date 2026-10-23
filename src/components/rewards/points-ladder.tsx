import { CheckIcon, LockIcon } from "@/components/icons";
import { RedeemButton } from "@/components/rewards/redeem-button";

const SCALE_MAX = 1000;

export function PointsLadder({
  monthlyPoints,
  loggedIn,
}: {
  monthlyPoints: number;
  loggedIn: boolean;
}) {
  const rungs = REWARDS.map((r) => ({ ...r, unlocked: monthlyPoints >= r.points }));
  const nextGoal = rungs.find((r) => !r.unlocked);
  const fillPct = Math.min(100, (monthlyPoints / SCALE_MAX) * 100);

  return (
    <div className="relative pl-11">
      <div className="absolute left-4 top-2 bottom-2 w-[3px] -translate-x-1/2 rounded-full bg-glass-border" />
      {loggedIn && (
        <div
          className="absolute left-4 top-2 w-[3px] -translate-x-1/2 rounded-full bg-green transition-[height]"
          style={{ height: `${fillPct}%` }}
        />
      )}

      <div className="flex flex-col gap-5">
        {rungs.map((rung) => {
          const isNextGoal = loggedIn && rung === nextGoal;
          return (
            <div key={rung.points} className="relative">
              <span
                className={`absolute -left-7 top-1 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border-2 ${
                  rung.unlocked
                    ? "border-green bg-green text-[#051530]"
                    : isNextGoal
                      ? "border-gold bg-bg-primary text-gold"
                      : "border-glass-border bg-bg-primary text-ink-muted"
                }`}
              >
                {rung.unlocked ? <CheckIcon size={12} /> : <LockIcon size={10} />}
              </span>

              <div
                className={`rounded-xl border p-4 transition ${
                  rung.unlocked
                    ? "border-green/30 bg-green/8"
                    : isNextGoal
                      ? "border-gold/35 bg-gold/8"
                      : "border-glass-border bg-glass opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                      {rung.points} pts
                      {isNextGoal && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-gold">
                          {rung.points - monthlyPoints} to go
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[14.5px] font-semibold">{rung.label}</div>
                    <div className="text-[12.5px] text-ink-muted">{rung.sub}</div>
                  </div>
                  {loggedIn ? (
                    <RedeemButton pointsCost={rung.points} disabled={!rung.unlocked} />
                  ) : (
                    rung.points === 100 && (
                      <span className="text-[11.5px] font-semibold text-ink-muted">Sign in to redeem</span>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const REWARDS = [
  { points: 100, label: "~35% off a game session", sub: "Any time slot" },
  { points: 250, label: "Free game session", sub: "Off-peak only" },
  { points: 500, label: "Free game session", sub: "Any time slot" },
  { points: 1000, label: "Free game + a month of Silver-level value", sub: "Biggest monthly reward" },
] as const;
