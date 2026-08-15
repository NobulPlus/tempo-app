import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getGameBySlug } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/session";
import { getMatchState, estimateTravelMinutes, leaveByTime } from "@/lib/match";
import { formatNaira, formatRelativeDay, formatTime, splitKobo } from "@/lib/format";
import { Countdown, FillBar, SpotPips, HeatPill, GuaranteePill } from "@/components/match/match-day";
import { JoinButton } from "@/components/match/join-button";
import { PlayerChip } from "@/components/player/player-card";
import {
  PinIcon,
  ClockIcon,
  CarIcon,
  StarIcon,
  ShieldIcon,
  WhatsAppIcon,
  UsersIcon,
  CheckIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Game not found" };

  return {
    title: `${game.title} — ${game.pitch.venue.area}`,
    description: `${game.level} ${game.pitch.size} at ${game.pitch.venue.name}, ${formatRelativeDay(game.startsAt)} ${formatTime(game.startsAt)}. ${formatNaira(game.pricePerPlayerKobo)} per player.`,
  };
}

const LEVEL_COPY: Record<string, string> = {
  casual: "All levels welcome. Nobody's counting the score too closely.",
  intermediate: "Comfortable on the ball, competitive but respectful.",
  competitive: "Serious game. Expect a high tempo and people who track back.",
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();

  const user = await getCurrentUser();
  const state = getMatchState(game);

  const confirmed = game.participants.filter((p) => p.status === "confirmed");
  const waitlist = game.participants.filter((p) => p.status === "waitlist");
  const mine = game.participants.find((p) => p.userId === user?.id);

  const kickoff = new Date(game.startsAt);
  const travel = estimateTravelMinutes(
    game.pitch.venue.side === "island" ? 8 : 11,
    kickoff,
    game.pitch.venue.side === "island",
  );
  const leaveBy = leaveByTime(kickoff, travel);

  const totalPitchKobo = game.pricePerPlayerKobo * game.capacity;
  const { each } = splitKobo(totalPitchKobo, Math.max(1, confirmed.length));

  const shareText = encodeURIComponent(
    `${game.title} — ${game.pitch.venue.name}, ${formatRelativeDay(game.startsAt)} ${formatTime(game.startsAt)}. ${state.spotsLeft} spots left, ${formatNaira(game.pricePerPlayerKobo)} each. Join: https://tempo.ng/games/${game.slug}`,
  );

  return (
    <div className="py-10">
      <div className="container-t">
        <nav className="mb-6 flex items-center gap-2 text-[13.5px] text-ink-muted">
          <Link href="/games" className="transition hover:text-green">
            Games
          </Link>
          <span>/</span>
          <span className="text-ink-soft">{game.pitch.venue.area}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
          {/* -------------------------------------------------- main column */}
          <div>
            <div className="card-t relative overflow-hidden p-6 md:p-8">
              <span className="spokes-t" />

              <div className="relative flex flex-wrap items-center gap-2">
                <HeatPill state={state} />
                <GuaranteePill
                  guaranteed={state.guaranteed}
                  minimum={game.minimumToGuarantee}
                />
                <span className="chip-t capitalize">{game.level}</span>
                {game.bibsProvided && <span className="chip-t">Bibs provided</span>}
              </div>

              <h1 className="relative mt-4 text-[clamp(26px,4.5vw,40px)] font-extrabold leading-tight tracking-[-.02em]">
                {game.title}
              </h1>

              <div className="relative mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14.5px] text-ink-soft">
                <Link
                  href={`/pitches/${game.pitch.slug}`}
                  className="flex items-center gap-1.5 transition hover:text-green"
                >
                  <PinIcon size={15} />
                  {game.pitch.venue.name}, {game.pitch.venue.area}
                </Link>
                <span className="flex items-center gap-1.5">
                  <ClockIcon size={15} />
                  {formatRelativeDay(game.startsAt)} · {formatTime(game.startsAt)}–
                  {formatTime(game.endsAt)}
                </span>
                <span className="chip-t">{game.pitch.size}</span>
              </div>

              <p className="relative mt-5 text-[15.5px] leading-relaxed text-ink-soft">
                {game.description}
              </p>
              <p className="relative mt-3 text-[13.5px] italic text-ink-muted">
                {LEVEL_COPY[game.level]}
              </p>

              {/* Live fill */}
              <div className="relative mt-7 rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] text-ink-muted">Squad</div>
                    <div className="mt-0.5 text-[24px] font-extrabold tabular-nums">
                      {state.filled}
                      <span className="text-[15px] font-semibold text-ink-muted">
                        /{state.capacity}
                      </span>
                    </div>
                  </div>
                  <Countdown
                    to={game.startsAt}
                    endsAt={game.endsAt}
                    className="text-[15px] font-semibold"
                  />
                </div>

                <div className="mt-3">
                  <FillBar percent={state.percent} heat={state.heat} />
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                  <SpotPips filled={state.filled} capacity={state.capacity} max={22} />
                  <span className="text-[13px] text-ink-soft">{state.label}</span>
                </div>

                {!state.guaranteed && (
                  <p className="mt-4 flex items-start gap-2 rounded-lg border border-gold/25 bg-gold/8 px-3.5 py-2.5 text-[13px] text-gold">
                    <ShieldIcon size={14} className="mt-0.5 shrink-0" />
                    {game.minimumToGuarantee - state.filled} more{" "}
                    {game.minimumToGuarantee - state.filled === 1 ? "player" : "players"}{" "}
                    and this game is guaranteed. If it doesn&apos;t reach{" "}
                    {game.minimumToGuarantee}, everyone is refunded in full — automatically.
                  </p>
                )}
              </div>
            </div>

            {/* -------------------------------------------------- the squad */}
            <section className="card-t mt-6 p-6 md:p-7">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[19px] font-bold">
                  <UsersIcon size={19} className="text-green" />
                  Who&apos;s playing
                </h2>
                <span className="text-[13px] text-ink-muted">
                  {confirmed.length} confirmed
                </span>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {confirmed.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p.player}
                    note={
                      p.userId === game.hostId
                        ? "Host"
                        : `${p.player.position ?? "—"} · ${p.player.punctualityScore}% punctual`
                    }
                  />
                ))}
                {Array.from({ length: Math.max(0, state.spotsLeft) })
                  .slice(0, 6)
                  .map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/12 p-2.5 text-[13px] text-ink-muted"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-white/15">
                        ?
                      </span>
                      Open spot
                    </div>
                  ))}
              </div>

              {waitlist.length > 0 && (
                <div className="mt-6 border-t border-white/8 pt-5">
                  <h3 className="text-[14px] font-semibold text-ink-soft">
                    Waitlist ({waitlist.length})
                  </h3>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {waitlist.map((p, i) => (
                      <PlayerChip key={p.id} player={p.player} note={`#${i + 1} in line`} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* -------------------------------------------------- side column */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="card-t p-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[12px] uppercase tracking-wide text-ink-muted">
                    Per player
                  </div>
                  <div className="text-[30px] font-extrabold">
                    {formatNaira(game.pricePerPlayerKobo)}
                  </div>
                </div>
                <div className="text-right text-[12.5px] text-ink-muted">
                  {confirmed.length > 0 && (
                    <>
                      Currently splitting
                      <br />
                      <b className="text-ink-soft">{formatNaira(each)}</b> each
                    </>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <JoinButton
                  gameId={game.id}
                  slug={game.slug}
                  priceKobo={game.pricePerPlayerKobo}
                  isMember={Boolean(mine)}
                  isWaitlisted={mine?.status === "waitlist"}
                  spotsLeft={state.spotsLeft}
                  signedIn={Boolean(user)}
                  hasEnded={state.hasEnded}
                />
              </div>

              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-t btn-ghost-t mt-2.5 w-full !py-3 !text-[14px]"
              >
                <WhatsAppIcon size={17} />
                Share to WhatsApp
              </a>
            </div>

            {/* Leave-by card — the Lagos-specific touch */}
            <div className="card-t p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-bold">
                <CarIcon size={17} className="text-orange" />
                When to leave
              </h3>
              <div className="mt-3 text-[26px] font-extrabold text-orange">
                {formatTime(leaveBy.toISOString())}
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                About {travel} minutes in {kickoff.getHours() >= 16 ? "evening" : "current"}{" "}
                traffic, plus 10 to change.
                {game.pitch.venue.side === "island"
                  ? " This one's on the Island — add time if you're crossing."
                  : " Mainland venue."}
              </p>
            </div>

            {/* Host */}
            <div className="card-t p-6">
              <h3 className="text-[15px] font-bold">Your host</h3>
              <Link
                href={`/players/${game.host.handle}`}
                className="group mt-3 flex items-center gap-3"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full border border-green/40 bg-green/10 text-[15px] font-bold">
                  {game.host.initials}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold group-hover:text-green">
                    {game.host.fullName}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                    <StarIcon size={11} className="text-gold" />
                    {game.host.peerRating?.toFixed(1) ?? "New"} ·{" "}
                    {game.host.gamesPlayed} games · {game.host.punctualityScore}% punctual
                  </span>
                </span>
              </Link>
            </div>

            {/* What's included */}
            <div className="card-t p-6">
              <h3 className="text-[15px] font-bold">What&apos;s included</h3>
              <ul className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                {[
                  "Pitch hire for the full slot",
                  game.bibsProvided ? "Bibs provided" : "Bring light and dark tops",
                  game.pitch.floodlights ? "Floodlights" : "Daylight only",
                  "Full refund if the game doesn't fill",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon size={14} className="mt-0.5 shrink-0 text-green" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
