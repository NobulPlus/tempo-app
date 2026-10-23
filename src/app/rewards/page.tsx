import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPlayerPointsSummary } from "@/lib/data/repo";
import { StarIcon, ShieldIcon, BallIcon, UsersIcon, PinIcon } from "@/components/icons";
import { PointsLadder } from "@/components/rewards/points-ladder";
import { TierStaircase } from "@/components/rewards/tier-staircase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rewards",
  description: "How points, redemptions and host tiers work on Tempo.",
};

const EARN = [
  { Icon: UsersIcon, label: "Host a game", points: 30 },
  { Icon: BallIcon, label: "Join an open game", points: 15 },
  { Icon: PinIcon, label: "Book a pitch solo", points: 10 },
] as const;

export default async function RewardsPage() {
  const user = await getCurrentUser();
  const { monthlyPoints, lifetimePoints } = user
    ? await getPlayerPointsSummary(user.id)
    : { monthlyPoints: 0, lifetimePoints: 0 };

  return (
    <div className="py-12">
      <div className="container-t max-w-5xl">
        <div className="grain-t relative overflow-hidden rounded-2xl border border-glass-border p-7 md:p-10">
          <span className="spokes-t" />
          <div className="relative">
            <span className="chip-t !border-gold/30 !bg-gold/10 !text-gold">
              <StarIcon size={13} />
              Tempo Rewards
            </span>

            <h1 className="mt-4 max-w-xl font-display text-[clamp(28px,5vw,42px)] font-extrabold leading-[1.1] tracking-[-.025em]">
              Earn points. <span className="text-gradient-brand">Host more.</span> Both pay off.
            </h1>
            <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-soft">
              Every played session earns points you can redeem for Tempo credit.
              Hosts who stay active climb tiers too, with priority placement and
              perks for Gold and Elite.
            </p>

            {!user ? (
              <Link
                href="/login?next=/rewards"
                className="btn-t btn-green-t glow-brand mt-6 inline-flex !py-3 !text-[14.5px]"
              >
                Sign in to start earning
              </Link>
            ) : (
              <div className="mt-6 flex flex-wrap gap-6">
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">This month</div>
                  <div className="mt-0.5 font-display text-[34px] font-extrabold">{monthlyPoints}</div>
                </div>
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">Lifetime</div>
                  <div className="mt-0.5 font-display text-[34px] font-extrabold text-ink-soft">{lifetimePoints}</div>
                </div>
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">Host tier</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[18px] font-bold capitalize">
                    <ShieldIcon size={16} className="text-green" />
                    {user.hostTier}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
          <section>
            <h2 className="text-[19px] font-bold">Playing</h2>
            <p className="mt-1 text-[13.5px] text-ink-soft">
              Points land once a session is actually played — not when you book it.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-[12.5px] text-ink-soft">
              {EARN.map(({ Icon, label, points }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Icon size={13} className="text-green" />
                  {label} <strong className="text-ink">+{points}</strong>
                </span>
              ))}
            </div>

            <div className="mt-5">
              <PointsLadder monthlyPoints={monthlyPoints} loggedIn={Boolean(user)} />
            </div>
          </section>

          <section>
            <h2 className="text-[19px] font-bold">Hosting</h2>
            <p className="mt-1 text-[13.5px] text-ink-soft">
              Based on games hosted in the trailing 30 days — a rolling window, not
              a lifetime total, so staying active is what keeps your tier.
            </p>
            <div className="mt-5">
              <TierStaircase currentTier={user?.hostTier} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
