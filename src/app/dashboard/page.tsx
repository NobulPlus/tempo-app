import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getGamesForUser } from "@/lib/data/repo";
import { getMatchState } from "@/lib/match";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { Countdown, FillBar, HeatPill } from "@/components/match/match-day";
import { StreakBadge, PunctualityRing } from "@/components/player/player-card";
import { NotificationPreferences } from "@/components/notification-preferences";
import { PinIcon, ClockIcon, BallIcon, CalendarIcon, ArrowRightIcon, StarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My games",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const games = await getGamesForUser(user.id);

  const upcoming = games.filter((g) => new Date(g.endsAt).getTime() > Date.now());
  const hosting = upcoming.filter((g) => g.hostId === user.id);
  const playing = upcoming.filter((g) => g.hostId !== user.id);
  const nextUp = upcoming[0];

  return (
    <div className="py-12">
      <div className="container-t">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[clamp(28px,5vw,42px)] font-extrabold tracking-[-.02em]">
              {greeting()}, {user.fullName.split(" ")[0]}
            </h1>
            <p className="mt-2 text-[16px] text-ink-soft">
              {nextUp
                ? `Your next game is ${formatRelativeDay(nextUp.startsAt).toLowerCase()} at ${formatTime(nextUp.startsAt)}.`
                : "Nothing in the diary. Let's fix that."}
            </p>
          </div>
          <Link href={`/players/${user.handle}`} className="btn-t btn-ghost-t !py-3 !text-[14px]">
            My player card
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card-t flex items-center gap-4 p-5">
            <PunctualityRing score={user.punctualityScore} />
            <div>
              <div className="text-[12px] text-ink-muted">Punctuality</div>
              <div className="text-[15px] font-semibold">
                {user.punctualityScore >= 95
                  ? "Impeccable"
                  : user.punctualityScore >= 85
                    ? "Reliable"
                    : user.punctualityScore >= 70
                      ? "Slipping"
                      : "Hosts notice this"}
              </div>
            </div>
          </div>

          <StreakBadge weeks={user.streakWeeks} longest={user.longestStreakWeeks} />

          <div className="card-t p-5">
            <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              <BallIcon size={13} /> Games played
            </div>
            <div className="mt-1 text-[26px] font-extrabold">{user.gamesPlayed}</div>
          </div>

          <div className="card-t p-5">
            <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              <StarIcon size={13} className="text-gold" /> Peer rating
            </div>
            <div className="mt-1 text-[26px] font-extrabold">{user.peerRating?.toFixed(1) ?? "—"}</div>
            <div className="text-[11.5px] text-ink-muted">{user.peerRatingCount} votes</div>
          </div>
        </div>

        {nextUp && (
          <section className="mt-10">
            <h2 className="text-[20px] font-bold">Next up</h2>
            <div className="card-t relative mt-4 overflow-hidden p-6 md:p-8">
              <span className="spokes-t" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <HeatPill state={getMatchState(nextUp)} />
                    {nextUp.hostId === user.id && (
                      <span className="chip-t !border-green/35 !bg-green/12 !text-green">
                        You&apos;re hosting
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-[24px] font-extrabold">{nextUp.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-ink-soft">
                    <span className="flex items-center gap-1.5">
                      <PinIcon size={14} />
                      {nextUp.pitch.venue.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ClockIcon size={14} />
                      {formatRelativeDay(nextUp.startsAt)} · {formatTime(nextUp.startsAt)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <Countdown to={nextUp.startsAt} endsAt={nextUp.endsAt} className="text-[17px] font-bold" />
                  <Link href={`/games/${nextUp.slug}`} className="btn-t btn-green-t mt-3 !px-6 !py-3 !text-[14px]">
                    Open game
                  </Link>
                </div>
              </div>
              <div className="relative mt-5">
                <FillBar percent={getMatchState(nextUp).percent} heat={getMatchState(nextUp).heat} />
              </div>
            </div>
          </section>
        )}

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <Section
            title="Games you've joined"
            empty="You haven't joined any games yet."
            cta={{ href: "/games", label: "Find a game" }}
            items={playing.map((g) => ({
              key: g.id,
              href: `/games/${g.slug}`,
              title: g.title,
              meta: `${g.pitch.venue.name} · ${formatRelativeDay(g.startsAt)} ${formatTime(g.startsAt)}`,
              right: formatNaira(g.pricePerPlayerKobo),
            }))}
          />

          <Section
            title="Games you're hosting"
            empty="You're not hosting anything right now."
            cta={{ href: "/host", label: "Host a game" }}
            items={hosting.map((g) => {
              const s = getMatchState(g);
              return {
                key: g.id,
                href: `/games/${g.slug}`,
                title: g.title,
                meta: `${s.filled}/${s.capacity} filled · ${s.label}`,
                right: formatRelativeDay(g.startsAt),
              };
            })}
          />

          <div className="card-t p-6">
            <h2 className="text-[18px] font-bold">Keep your streak alive</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              {user.streakWeeks > 0
                ? `You've played every week for ${user.streakWeeks} weeks. Play once more this week to keep it going — your best run is ${user.longestStreakWeeks}.`
                : "Play a game this week to start a streak. Your best run so far is " +
                  user.longestStreakWeeks +
                  " weeks."}
            </p>
            <Link href="/games" className="btn-t btn-green-t mt-5 !py-3 !text-[14px]">
              <CalendarIcon size={16} />
              Browse this week&apos;s games
            </Link>
          </div>

          <NotificationPreferences />
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function Section({
  title,
  items,
  empty,
  cta,
}: {
  title: string;
  items: { key: string; href: string; title: string; meta: string; right: string }[];
  empty: string;
  cta: { href: string; label: string };
}) {
  return (
    <section>
      <h2 className="text-[18px] font-bold">{title}</h2>
      {items.length === 0 ? (
        <div className="card-t mt-4 p-6 text-center">
          <p className="text-[14.5px] text-ink-soft">{empty}</p>
          <Link
            href={cta.href}
            className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green transition hover:gap-2.5"
          >
            {cta.label} <ArrowRightIcon size={15} />
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="card-t flex items-center gap-4 p-4 transition hover:border-green/30">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{i.title}</div>
                  <div className="truncate text-[12.5px] text-ink-muted">{i.meta}</div>
                </div>
                <div className="shrink-0 text-[14px] font-bold">{i.right}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
