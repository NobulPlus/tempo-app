import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPlayerPointsSummary } from "@/lib/data/repo";
import { StarIcon } from "@/components/icons";
import { RedeemButton } from "@/components/rewards/redeem-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rewards",
  robots: { index: false, follow: false },
};

const REWARDS = [
  { points: 100, label: "~35% off a game session", sub: "Any time slot" },
  { points: 250, label: "Free game session", sub: "Off-peak only" },
  { points: 500, label: "Free game session", sub: "Any time slot" },
  { points: 1000, label: "Free game + a month of Silver-level value", sub: "Biggest monthly reward" },
] as const;

export default async function RewardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/rewards");

  const { monthlyPoints, lifetimePoints } = await getPlayerPointsSummary(user.id);

  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <h1 className="font-display text-[clamp(26px,4.5vw,36px)] font-extrabold tracking-[-.02em]">
          Rewards
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Earn points by hosting, joining and booking — redeem them against Tempo credit.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="card-t p-5">
            <div className="flex items-center gap-2 text-[12px] text-ink-muted">
              <StarIcon size={14} className="text-gold" />
              This month
            </div>
            <div className="mt-1 text-[28px] font-extrabold">{monthlyPoints}</div>
            <p className="mt-1 text-[12.5px] text-ink-muted">Resets at the start of next month</p>
          </div>
          <div className="card-t p-5">
            <div className="flex items-center gap-2 text-[12px] text-ink-muted">
              <StarIcon size={14} className="text-gold" />
              Lifetime
            </div>
            <div className="mt-1 text-[28px] font-extrabold">{lifetimePoints}</div>
            <p className="mt-1 text-[12.5px] text-ink-muted">Never resets</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-glass-border bg-glass p-4 text-[13px] text-ink-soft">
          <strong className="text-ink">How you earn:</strong> host a game (30 pts), join an
          open game (15 pts), book a pitch solo (10 pts) — points land once the session
          is actually played, not when you book.
        </div>

        <h2 className="mt-8 text-[17px] font-bold">Redeem this month&apos;s points</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {REWARDS.map((reward) => (
            <div key={reward.points} className="card-t flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-[14.5px] font-semibold">{reward.label}</div>
                <div className="text-[12.5px] text-ink-muted">{reward.sub}</div>
              </div>
              <RedeemButton pointsCost={reward.points} disabled={monthlyPoints < reward.points} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
