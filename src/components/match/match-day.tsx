"use client";

import { useEffect, useMemo, useState } from "react";
import { getMatchState, formatCountdown } from "@/lib/match";
import type { MatchState, MatchHeat } from "@/lib/types";
import { FlameIcon, ShieldIcon, CheckIcon } from "@/components/icons";

/* ------------------------------------------------------------------------ */
/* Countdown — the single most useful number on a match card.                */
/* ------------------------------------------------------------------------ */

export function Countdown({
  to,
  endsAt,
  className = "",
  prefix = "Kickoff in",
}: {
  to: string;
  endsAt?: string;
  className?: string;
  prefix?: string;
}) {
  // Render nothing time-sensitive on the server, then hydrate — avoids the
  // classic "server said 3h 12m, client says 3h 11m" mismatch.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const ms = new Date(to).getTime() - Date.now();
    // Tick every second inside the last hour, otherwise every 30s.
    const interval = Math.abs(ms) < 3_600_000 ? 1000 : 30_000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [to]);

  if (now === null) {
    return <span className={className} suppressHydrationWarning />;
  }

  const start = new Date(to).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 90 * 60_000;

  if (now >= end) return <span className={className}>Full time</span>;
  if (now >= start)
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="live-dot" />
        <span className="font-semibold text-green">Playing now</span>
      </span>
    );

  const ms = start - now;
  const urgent = ms < 3 * 3_600_000;

  return (
    <span
      className={`${className} ${urgent ? "text-orange" : ""}`}
      suppressHydrationWarning
    >
      {prefix} <b className="tabular-nums">{formatCountdown(ms)}</b>
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Fill bar — animates from 0 on mount so arriving on the page feels alive.  */
/* ------------------------------------------------------------------------ */

export function FillBar({ percent, heat }: { percent: number; heat: MatchHeat }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  return (
    <div
      className="fill-track"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percent}% full`}
    >
      <div className="fill-bar" data-heat={heat} style={{ width: `${width}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Spot pips — a shirt per spot. Reading "7/10" takes a beat; seeing three   */
/* empty shirts is instant.                                                  */
/* ------------------------------------------------------------------------ */

export function SpotPips({
  filled,
  capacity,
  max = 14,
}: {
  filled: number;
  capacity: number;
  max?: number;
}) {
  const show = Math.min(capacity, max);
  const overflow = capacity - show;

  return (
    <div className="flex flex-wrap items-center gap-1" aria-hidden="true">
      {Array.from({ length: show }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-[3px] transition-colors duration-500 ${
            i < filled ? "bg-green" : "border border-glass-border bg-glass"
          }`}
          style={{ transitionDelay: `${i * 35}ms` }}
        />
      ))}
      {overflow > 0 && (
        <span className="ml-1 text-[11px] text-ink-muted">+{overflow}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Heat pill — one glance tells you whether to hurry.                        */
/* ------------------------------------------------------------------------ */

const HEAT_STYLES: Record<MatchHeat, string> = {
  cold: "border-blue/30 bg-blue/10 text-blue",
  warm: "border-gold/35 bg-gold/12 text-gold",
  hot: "border-orange/40 bg-orange/14 text-orange",
  full: "border-white/15 bg-white/6 text-ink-soft",
};

export function HeatPill({ state }: { state: MatchState }) {
  return (
    <span
      className={`chip-t !border ${HEAT_STYLES[state.heat]}`}
      title={`${state.filled} of ${state.capacity} spots taken`}
    >
      {state.heat === "hot" && <FlameIcon size={12} className="animate-[flame_2.4s_ease-in-out_infinite]" />}
      {state.heat === "full" && <CheckIcon size={12} />}
      {state.label}
    </span>
  );
}

export function GuaranteePill({ guaranteed, minimum }: { guaranteed: boolean; minimum: number }) {
  return guaranteed ? (
    <span className="chip-t !border-green/35 !bg-green/12 !text-green">
      <ShieldIcon size={13} />
      Guaranteed
    </span>
  ) : (
    <span className="chip-t" title={`${minimum} players needed for this game to be guaranteed`}>
      <ShieldIcon size={13} />
      {minimum} to confirm
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Live spot counter — animates when the number changes.                     */
/* ------------------------------------------------------------------------ */

export function SpotCounter({ filled, capacity }: { filled: number; capacity: number }) {
  const [flash, setFlash] = useState(false);
  const [prev, setPrev] = useState(filled);

  useEffect(() => {
    if (filled !== prev) {
      setFlash(true);
      setPrev(filled);
      const id = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(id);
    }
  }, [filled, prev]);

  return (
    <span className={`tabular-nums transition-colors duration-300 ${flash ? "text-green" : ""}`}>
      <b>{filled}</b>
      <span className="text-ink-muted">/{capacity}</span>
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Hook: derive live match state on the client so labels update without a    */
/* refresh (a game flips to "Playing now" while the tab is open).            */
/* ------------------------------------------------------------------------ */

export function useLiveMatchState(game: {
  capacity: number;
  minimumToGuarantee: number;
  startsAt: string;
  endsAt: string;
  status: string;
  filled?: number;
}): MatchState {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return useMemo(
    () => getMatchState(game as Parameters<typeof getMatchState>[0]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game.filled, game.capacity, game.startsAt, game.endsAt, tick],
  );
}
