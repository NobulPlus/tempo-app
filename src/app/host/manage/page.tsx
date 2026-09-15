import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getGamesForUser } from "@/lib/data/repo";
import { getMatchState } from "@/lib/match";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { ArrowRightIcon, BallIcon, CalendarIcon, WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Host dashboard",
  robots: { index: false, follow: false },
};

export default async function HostManagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host/manage");

  const games = await getGamesForUser(user.id);
  const hosted = games.filter((game) => game.hostId === user.id);
  const now = new Date().getTime();
  const upcoming = hosted
    .filter((game) => new Date(game.endsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = hosted
    .filter((game) => new Date(game.endsAt).getTime() <= now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const committed = upcoming.filter((game) => getMatchState(game).guaranteed).length;
  const totalHeldKobo = upcoming.reduce((sum, game) => sum + (game.hostPaidKobo ?? 0), 0);
  const totalReimbursedKobo = hosted.reduce((sum, game) => sum + (game.hostReimbursedKobo ?? 0), 0);

  return (
    <div className="py-12">
      <div className="container-t">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-muted">
          <Link href="/dashboard" className="transition hover:text-green">
            My games
          </Link>
          <span>/</span>
          <span className="text-ink">Host dashboard</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[clamp(30px,5vw,44px)] font-extrabold">Host dashboard</h1>
            <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-ink-soft">
              Track the games you created, watch the roster fill up, and handle minimum decisions from each game page.
            </p>
          </div>
          <Link href="/host" className="btn-t btn-green-t !py-3 !text-[14px]">
            Host another game
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat icon={<BallIcon size={16} />} label="Upcoming hosted" value={String(upcoming.length)} />
          <Stat icon={<CalendarIcon size={16} />} label="Going ahead" value={String(committed)} />
          <Stat icon={<WalletIcon size={16} />} label="Reimbursed so far" value={formatNaira(totalReimbursedKobo)} />
        </div>

        {totalHeldKobo > 0 && (
          <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/8 p-4 text-[13.5px] text-ink-soft">
            <strong className="text-gold">{formatNaira(totalHeldKobo)}</strong> is currently tied to upcoming pitch reservations.
            Player payments can reimburse the host wallet up to the amount paid for each pitch.
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-[20px] font-bold">Upcoming games</h2>
          <GameList
            games={upcoming}
            now={now}
            empty="You are not hosting any upcoming games."
            cta={{ href: "/host", label: "Create a game" }}
          />
        </section>

        <section className="mt-10">
          <h2 className="text-[20px] font-bold">Past hosted games</h2>
          <GameList
            games={past.slice(0, 12)}
            now={now}
            empty="Past games you host will appear here."
            cta={{ href: "/games", label: "Browse games" }}
          />
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-t p-5">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[25px] font-extrabold">{value}</div>
    </div>
  );
}

function GameList({
  games,
  now,
  empty,
  cta,
}: {
  games: Awaited<ReturnType<typeof getGamesForUser>>;
  now: number;
  empty: string;
  cta: { href: string; label: string };
}) {
  if (games.length === 0) {
    return (
      <div className="card-t mt-4 p-6 text-center">
        <p className="text-[14.5px] text-ink-soft">{empty}</p>
        <Link
          href={cta.href}
          className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-green transition hover:gap-2.5"
        >
          {cta.label} <ArrowRightIcon size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      {games.map((game) => {
        const state = getMatchState(game);
        const needsDecision =
          game.minimumDecisionStatus === "pending" &&
          !state.guaranteed &&
          new Date(game.minimumDecisionDeadline ?? game.startsAt).getTime() <= now;
        return (
          <Link key={game.id} href={`/games/${game.slug}`} className="card-t block p-5 transition hover:border-green/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[16px] font-bold">{game.title}</h3>
                  {needsDecision && (
                    <span className="rounded-full border border-orange/35 bg-orange/10 px-2.5 py-1 text-[11px] font-bold text-orange">
                      Decision needed
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-ink-soft">
                  {game.pitch.venue.name} · {formatRelativeDay(game.startsAt)} · {formatTime(game.startsAt)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[14px] font-bold">
                  {state.filled}/{state.capacity} players
                </div>
                <div className="mt-0.5 text-[12px] text-ink-muted">{state.label}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
