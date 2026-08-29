import Link from "next/link";
import { getMatchState } from "@/lib/match";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { PinIcon, ClockIcon, StarIcon, BallDetailedIcon } from "@/components/icons";
import { Countdown, FillBar, HeatPill, GuaranteePill, SpotPips } from "./match-day";
import type { GameFull } from "@/lib/data/repo";

const LEVEL_STYLE: Record<string, string> = {
  casual: "!border-blue/30 !bg-blue/10 !text-blue",
  intermediate: "!border-green/30 !bg-green/10 !text-green",
  competitive: "!border-purple/35 !bg-purple/14 !text-purple",
};

export function GameCard({ game }: { game: GameFull }) {
  const state = getMatchState(game);

  return (
    <article className="card-t card-t-hover relative flex flex-col overflow-hidden p-5">
      <span className="spokes-t" />

      <div className="relative flex flex-wrap items-center gap-2">
        <span className={`chip-t !border ${LEVEL_STYLE[game.level]}`}>
          {game.level[0].toUpperCase() + game.level.slice(1)}
        </span>
        <GuaranteePill guaranteed={state.guaranteed} minimum={game.minimumToGuarantee} />
        <span className="ml-auto">
          <HeatPill state={state} />
        </span>
      </div>

      <Link href={`/games/${game.slug}`} className="relative mt-3.5 block">
        <h3 className="text-[19px] font-bold leading-snug transition-colors hover:text-green">
          {game.title}
        </h3>
      </Link>

      <div className="relative mt-1.5 flex items-center gap-1.5 text-[13.5px] text-ink-soft">
        <PinIcon size={14} />
        {game.pitch.venue.name} · {game.pitch.venue.area} · {game.pitch.size}
      </div>

      <p className="relative mt-3 line-clamp-2 text-[14px] leading-relaxed text-ink-soft">
        {game.description}
      </p>

      <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon size={14} />
          {formatRelativeDay(game.startsAt)} · {formatTime(game.startsAt)}
        </span>
        <Countdown to={game.startsAt} endsAt={game.endsAt} className="text-[13px]" />
      </div>

      <div className="relative mt-4">
        <div className="mb-2 flex items-center justify-between text-[13px]">
          <SpotPips filled={state.filled} capacity={state.capacity} />
          <span className="font-semibold text-ink-soft">
            {state.filled}/{state.capacity}
          </span>
        </div>
        <FillBar percent={state.percent} heat={state.heat} />
      </div>

      <div className="relative mt-4 flex items-center justify-between border-t border-glass-border pt-4">
        <Link href={`/players/${game.host.handle}`} className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-green/40 bg-green/10 text-[12px] font-bold">
            {game.host.initials}
          </span>
          <span className="leading-tight">
            <span className="block text-[13.5px] font-semibold group-hover:text-green">
              {game.host.fullName}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-ink-muted">
              <StarIcon size={11} className="text-gold" />
              {game.host.peerRating?.toFixed(1) ?? "New"} · {game.host.gamesPlayed} games
            </span>
          </span>
        </Link>

        <div className="text-right leading-tight">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">per player</div>
          <div className="text-[17px] font-bold">{formatNaira(game.pricePerPlayerKobo)}</div>
        </div>
      </div>

      <Link
        href={`/games/${game.slug}`}
        className={`btn-t mt-4 w-full !py-3.5 !text-[14.5px] ${
          state.spotsLeft === 0 ? "btn-ghost-t" : "btn-green-t"
        }`}
      >
        {state.hasEnded
          ? "View result"
          : state.spotsLeft === 0
            ? "Join waitlist"
            : `Join game — ${formatNaira(game.pricePerPlayerKobo)}`}
      </Link>
    </article>
  );
}

/** Compact variant for the homepage "kicking off soon" rail. */
export function GameCardMini({ game }: { game: GameFull }) {
  const state = getMatchState(game);
  return (
    <Link
      href={`/games/${game.slug}`}
      className="card-t card-t-hover relative block overflow-hidden p-4"
    >
      <span className="spokes-t" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{game.title}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">
            {game.pitch.venue.area} · {formatTime(game.startsAt)}
          </div>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green/10 text-green">
          <BallDetailedIcon size={22} />
        </span>
      </div>
      <div className="relative mt-3">
        <FillBar percent={state.percent} heat={state.heat} />
      </div>
      <div className="relative mt-2 flex items-center justify-between text-[12.5px]">
        <span className="text-ink-soft">{state.label}</span>
        <span className="font-semibold">{formatNaira(game.pricePerPlayerKobo, { compact: true })}</span>
      </div>
    </Link>
  );
}
