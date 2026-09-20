import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { canManageGameAttendance, getGameBySlug, getGameChatMessages, getGameCheckInCode, getGameCheckInCodes, getWalletBalance, listGames } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/session";
import { getMatchState, estimateTravelMinutes, leaveByTime } from "@/lib/match";
import { formatNaira, formatRelativeDay, formatTime, splitKobo } from "@/lib/format";
import { Countdown, FillBar, SpotPips, HeatPill, GuaranteePill } from "@/components/match/match-day";
import { JoinButton } from "@/components/match/join-button";
import { MinimumDecisionBanner, HostReimbursementCard } from "@/components/match/host-controls";
import { AttendancePanel } from "@/components/match/attendance-panel";
import { GameChatPanel } from "@/components/match/game-chat-panel";
import { PlayerChip } from "@/components/player/player-card";
import {
  PinIcon,
  ClockIcon,
  CarIcon,
  StarIcon,
  WhatsAppIcon,
  UsersIcon,
  CheckIcon,
} from "@/components/icons";

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

export const dynamic = "force-dynamic";

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
  const nearbyAlternatives = state.spotsLeft === 0
    ? (await listGames()).filter((candidate) => {
        const candidateState = getMatchState(candidate);
        return candidate.id !== game.id && candidateState.spotsLeft > 0 &&
          candidate.pitch.venue.area === game.pitch.venue.area &&
          Math.abs(new Date(candidate.startsAt).getTime() - new Date(game.startsAt).getTime()) <= 3 * 60 * 60 * 1000;
      }).slice(0, 3)
    : [];

  const confirmed = game.participants.filter(
    (p) => p.status === "confirmed" || p.status === "pending_payment",
  );
  const waitlist = game.participants.filter((p) => p.status === "waitlist");
  const mine = user ? game.participants.find((p) => p.userId === user.id) : undefined;
  const isHost = Boolean(user && user.id === game.hostId);
  const canManageAttendance = user ? await canManageGameAttendance(game.id, user.id) : false;
  const preconfirmed = game.preconfirmedPlayerCount ?? 0;
  const isCancelled = game.status === "cancelled";
  const refundable = game.participants.filter(
    (p) => (p.status === "confirmed" || p.status === "pending_payment") && p.paidKobo > 0,
  );
  const refundKobo = refundable.reduce((sum, p) => sum + p.paidKobo, 0);
  const canHostCancel = state.filled * 100 < game.capacity * 80;

  const kickoff = new Date(game.startsAt);
  const travel = estimateTravelMinutes(
    game.pitch.venue.side === "island" ? 8 : 11,
    kickoff,
    game.pitch.venue.side === "island",
  );
  const leaveBy = leaveByTime(kickoff, travel);

  const committed = game.minimumDecisionStatus === "go_ahead" || game.minimumDecisionStatus === "not_needed";
  const showReimbursement = isHost && committed && !isCancelled;
  const mineCode = user && mine && !isCancelled ? await getGameCheckInCode(game.id, user.id) : null;
  const confirmedParticipantIds = new Set(confirmed.map((participant) => participant.id));
  const checkInCodes = canManageAttendance
    ? (await getGameCheckInCodes(game.id)).filter((item) => confirmedParticipantIds.has(item.participantId))
    : [];
  const canChat = Boolean(
    user &&
      !isCancelled &&
      (isHost || (mine && ["confirmed", "pending_payment", "played", "no_show"].includes(mine.status))),
  );
  const chatMessages = canChat ? await getGameChatMessages(game.id) : [];
  const walletBalanceKobo = user ? await getWalletBalance(user.id) : 0;

  const totalPitchKobo = game.pricePerPlayerKobo * game.capacity;
  const { each } = splitKobo(totalPitchKobo, Math.max(1, confirmed.length));

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://playtempo11.com";
  const shareText = encodeURIComponent(
    `${game.title} — ${game.pitch.venue.name}, ${formatRelativeDay(game.startsAt)} ${formatTime(game.startsAt)}. ${state.spotsLeft} spots left, ${formatNaira(game.pricePerPlayerKobo)} each. Join: ${site}/games/${game.slug}`,
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
          <div>
            <div className="card-t relative overflow-hidden p-6 md:p-8">
              <span className="spokes-t" />

              <div className="relative flex flex-wrap items-center gap-2">
                <HeatPill state={state} />
                <GuaranteePill guaranteed={state.guaranteed} minimum={game.minimumToGuarantee} />
                <span className="chip-t capitalize">{game.level}</span>
                {game.bibsProvided && <span className="chip-t">Bibs provided</span>}
              </div>

              <h1 className="relative mt-4 font-display text-[clamp(26px,4.5vw,40px)] font-extrabold leading-tight tracking-[-.02em]">
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

              <div className="relative mt-7 rounded-2xl border border-glass-border bg-bg-primary/40 p-5">
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
                  <Countdown to={game.startsAt} endsAt={game.endsAt} className="text-[15px] font-semibold" />
                </div>

                <div className="mt-3">
                  <FillBar percent={state.percent} heat={state.heat} />
                </div>

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                  <SpotPips filled={state.filled} capacity={state.capacity} max={22} />
                  <span className="text-[13px] text-ink-soft">{state.label}</span>
                </div>

                {!state.guaranteed && !isCancelled && (
                  <MinimumDecisionBanner
                    gameId={game.id}
                    slug={game.slug}
                    isHost={isHost}
                    spotsNeeded={game.minimumToGuarantee - state.filled}
                    minimum={game.minimumToGuarantee}
                    deadline={game.minimumDecisionDeadline ?? null}
                  />
                )}
              </div>
            </div>

            <section className="card-t mt-6 p-6 md:p-7">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[19px] font-bold">
                  <UsersIcon size={19} className="text-green" />
                  Who&apos;s playing
                </h2>
                <span className="text-[13px] text-ink-muted">{state.filled} confirmed</span>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {preconfirmed > 0 && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-green/25 bg-green/8 p-3 text-[13px] text-green">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green/35 font-bold">{preconfirmed}</span>
                    {preconfirmed} regular{preconfirmed === 1 ? " is" : "s are"} already confirmed
                  </div>
                )}
                {confirmed.map((p) => (
                  <PlayerChip
                    key={p.id}
                    player={p.player}
                    note={
                      p.userId === game.hostId
                        ? "Host"
                        : p.status === "pending_payment"
                          ? "Payment pending"
                          : `${p.player.position ?? "—"} · ${p.player.punctualityScore}% punctual`
                    }
                  />
                ))}
                {Array.from({ length: Math.max(0, state.spotsLeft) })
                  .slice(0, 6)
                  .map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-2.5 rounded-xl border border-dashed border-glass-border p-2.5 text-[13px] text-ink-muted"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-glass-border">
                        ?
                      </span>
                      Open spot
                    </div>
                  ))}
              </div>

              {waitlist.length > 0 && (
                <div className="mt-6 border-t border-glass-border pt-5">
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

            {canChat && user && (
              <GameChatPanel
                gameId={game.id}
                gameSlug={game.slug}
                currentUserId={user.id}
                initialMessages={chatMessages}
              />
            )}

            {!isCancelled && (
              <AttendancePanel
                slug={game.slug}
                canManage={canManageAttendance}
                mineCode={mineCode}
                participants={confirmed}
                checkInCodes={checkInCodes}
              />
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {showReimbursement && (
              <HostReimbursementCard
                gameId={game.id}
                slug={game.slug}
                hostPaidKobo={game.hostPaidKobo ?? 0}
                hostReimbursedKobo={game.hostReimbursedKobo ?? 0}
                hostPitchCostKobo={game.hostPitchCostKobo}
                hostEarningsKobo={game.hostEarningsKobo}
              />
            )}

            <div className="card-t p-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[12px] uppercase tracking-wide text-ink-muted">Per player</div>
                  <div className="text-[30px] font-extrabold">{formatNaira(game.pricePerPlayerKobo)}</div>
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
                  isPendingPayment={mine?.status === "pending_payment"}
                  paidKobo={mine?.paidKobo ?? 0}
                  paymentDeadline={mine?.paymentDeadline ?? null}
                  isHost={isHost}
                  isCancelled={isCancelled}
                  refundCount={refundable.length}
                  refundKobo={refundKobo}
                  spotsLeft={state.spotsLeft}
                  signedIn={Boolean(user)}
                  hasEnded={state.hasEnded}
                  walletBalanceKobo={walletBalanceKobo}
                  canHostCancel={canHostCancel}
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

            {nearbyAlternatives.length > 0 && (
              <div className="card-t p-6">
                <h3 className="text-[15px] font-bold">Other games nearby</h3>
                <div className="mt-3 space-y-2">
                  {nearbyAlternatives.map((alternative) => (
                    <Link key={alternative.id} href={`/games/${alternative.slug}`} className="block rounded-lg border border-white/10 bg-white/4 p-3 transition hover:border-green/35">
                      <div className="text-[13.5px] font-semibold">{alternative.title}</div>
                      <div className="mt-1 text-[12px] text-ink-muted">{formatTime(alternative.startsAt)} · {getMatchState(alternative).spotsLeft} spaces left</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="card-t p-6">
              <h3 className="flex items-center gap-2 text-[15px] font-bold">
                <CarIcon size={17} className="text-orange" />
                When to leave
              </h3>
              <div className="mt-3 text-[26px] font-extrabold text-orange">
                {formatTime(leaveBy.toISOString())}
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                About {travel} minutes in {kickoff.getHours() >= 16 ? "evening" : "current"} traffic,
                plus 10 to change.
                {game.pitch.venue.side === "island"
                  ? " This one's on the Island — add time if you're crossing."
                  : " Mainland venue."}
              </p>
            </div>

            <div className="card-t p-6">
              <h3 className="text-[15px] font-bold">Your host</h3>
              <Link href={`/players/${game.host.handle}`} className="group mt-3 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-green/40 bg-green/10 text-[15px] font-bold">
                  {game.host.initials}
                </span>
                <span>
                  <span className="block text-[15px] font-semibold group-hover:text-green">
                    {game.host.fullName}
                  </span>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                    <StarIcon size={11} className="text-gold" />
                    {game.host.peerRating?.toFixed(1) ?? "New"} · {game.host.gamesPlayed} games ·{" "}
                    {game.host.punctualityScore}% punctual
                  </span>
                </span>
              </Link>
            </div>

            <div className="card-t p-6">
              <h3 className="text-[15px] font-bold">What&apos;s included</h3>
              <ul className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                {[
                  "Pitch hire for the full slot",
                  game.bibsProvided ? "Bibs provided" : "Bring light and dark tops",
                  game.pitch.floodlights ? "Floodlights" : "Daylight only",
                  "Full refund if the game is cancelled",
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
