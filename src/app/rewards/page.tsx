import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPlayerPointsSummary } from "@/lib/data/repo";
import { StarIcon, ShieldIcon, BallIcon, UsersIcon, PinIcon } from "@/components/icons";
import { RedeemButton } from "@/components/rewards/redeem-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rewards",
  description: "How points, redemptions and host tiers work on Tempo.",
};

const REWARDS = [
  { points: 100, label: "~35% off a game session", sub: "Any time slot" },
  { points: 250, label: "Free game session", sub: "Off-peak only" },
  { points: 500, label: "Free game session", sub: "Any time slot" },
  { points: 1000, label: "Free game + a month of Silver-level value", sub: "Biggest monthly reward" },
] as const;

const EARN = [
  { Icon: UsersIcon, label: "Host a game", points: 30 },
  { Icon: BallIcon, label: "Join an open game", points: 15 },
  { Icon: PinIcon, label: "Book a pitch solo", points: 10 },
] as const;

const HOST_TIERS = [
  { tier: "Bronze", range: "1–4 games", perk: "Baseline — every host starts here" },
  { tier: "Silver", range: "5–9 games", perk: "Priority placement at the same kickoff time" },
  { tier: "Gold", range: "10–19 games", perk: "Priority placement + a monthly perk credit" },
  { tier: "Elite", range: "20+ games", perk: "Priority placement + a bigger monthly perk credit" },
] as const;

export default async function RewardsPage() {
  const user = await getCurrentUser();
  const { monthlyPoints, lifetimePoints } = user
    ? await getPlayerPointsSummary(user.id)
    : { monthlyPoints: 0, lifetimePoints: 0 };

  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <span className="chip-t !border-gold/30 !bg-gold/10 !text-gold">
          <StarIcon size={13} />
          Tempo Rewards
        </span>

        <h1 className="mt-4 text-[clamp(28px,5vw,42px)] font-extrabold tracking-[-.025em]">
          Earn points. Host more. Both pay off.
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
          Every played session earns points you can redeem for Tempo credit. Hosts
          who stay active also climb tiers, with priority placement and perks for
          Gold and Elite.
        </p>

        {!user && (
          <div className="mt-6 rounded-xl border border-green/30 bg-green/10 p-4 text-[13.5px] text-ink">
            <Link href="/login?next=/rewards" className="font-semibold text-green underline underline-offset-2">
              Sign in
            </Link>{" "}
            to see your points balance and redeem rewards.
          </div>
        )}

        {user && (
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
        )}

        <h2 className="mt-10 text-[19px] font-bold">How you earn points</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          Points land once a session is actually played — not when you book it.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {EARN.map(({ Icon, label, points }) => (
            <div key={label} className="card-t p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-glass text-green">
                <Icon size={16} />
              </span>
              <div className="mt-3 text-[14px] font-semibold">{label}</div>
              <div className="mt-0.5 text-[13px] text-ink-muted">+{points} points</div>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-[19px] font-bold">Redeem this month&apos;s points</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {REWARDS.map((reward) => (
            <div key={reward.points} className="card-t flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-[14.5px] font-semibold">{reward.label}</div>
                <div className="text-[12.5px] text-ink-muted">{reward.sub}</div>
              </div>
              {user ? (
                <RedeemButton pointsCost={reward.points} disabled={monthlyPoints < reward.points} />
              ) : (
                <span className="text-[12.5px] font-semibold text-ink-muted">{reward.points} pts</span>
              )}
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-[19px] font-bold">Host tiers</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          Based on games hosted in the trailing 30 days — always a rolling window,
          never a lifetime total, so staying active is what keeps your tier.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-glass-border">
          {HOST_TIERS.map((row, i) => (
            <div
              key={row.tier}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 text-[13.5px] ${
                i % 2 === 1 ? "bg-glass" : ""
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <ShieldIcon size={14} className="text-green" />
                {row.tier}
              </span>
              <span className="text-ink-soft">{row.range}</span>
              <span className="text-right text-ink-muted">{row.perk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
