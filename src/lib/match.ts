import type { Game, MatchState, MatchHeat } from "./types";

/**
 * The single source of truth for "what state is this game in?"
 *
 * The original prototype hardcoded a percentage and coloured a bar. This
 * derives every label, colour and CTA from real numbers so the UI can never
 * drift from the data.
 */
export function getMatchState(
  game: Pick<Game, "capacity" | "minimumToGuarantee" | "startsAt" | "endsAt" | "status"> & {
    filled?: number;
  },
  now: Date = new Date(),
): MatchState {
  const filled = game.filled ?? 0;
  const capacity = Math.max(1, game.capacity);
  const percent = Math.min(100, Math.round((filled / capacity) * 100));
  const spotsLeft = Math.max(0, capacity - filled);
  const guaranteed = filled >= game.minimumToGuarantee;

  const start = new Date(game.startsAt).getTime();
  const end = new Date(game.endsAt).getTime();
  const msToKickoff = start - now.getTime();
  const isLive = now.getTime() >= start && now.getTime() < end;
  const hasEnded = now.getTime() >= end;

  let heat: MatchHeat = "cold";
  if (spotsLeft === 0) heat = "full";
  else if (percent >= 75) heat = "hot";
  else if (percent >= 45) heat = "warm";

  let label: string;
  if (hasEnded) label = "Full time";
  else if (isLive) label = "Kicking off now";
  else if (spotsLeft === 0) label = "Locked in";
  else if (spotsLeft === 1) label = "1 spot left";
  else if (heat === "hot") label = `Filling fast — ${spotsLeft} left`;
  else if (guaranteed) label = `Going ahead — ${spotsLeft} spots`;
  else label = `${spotsLeft} spots open`;

  return {
    filled,
    capacity,
    percent,
    spotsLeft,
    heat,
    guaranteed,
    label,
    msToKickoff,
    isLive,
    hasEnded,
  };
}

/**
 * Human countdown. Deliberately coarse above an hour — nobody needs
 * "2 days, 4 hours, 17 minutes and 3 seconds".
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";

  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);

  if (days >= 1) return `${days}d ${hrs % 24}h`;
  if (hrs >= 1) return `${hrs}h ${min % 60}m`;
  if (min >= 1) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

/**
 * Lagos traffic is a first-class product concern. A 7pm kickoff in Lekki
 * means leaving Yaba at 5. These are rough, honest multipliers — better a
 * useful estimate than a fake-precise one.
 */
export function estimateTravelMinutes(
  distanceKm: number,
  kickoff: Date,
  crossesBridge: boolean,
): number {
  const hour = kickoff.getHours();
  const day = kickoff.getDay(); // 0 Sun … 6 Sat
  const weekday = day >= 1 && day <= 5;

  // Base speed in km/h
  let speed = 28;
  if (weekday && hour >= 16 && hour <= 20) speed = 12; // evening rush
  else if (weekday && hour >= 6 && hour <= 10) speed = 14; // morning rush
  else if (hour >= 22 || hour <= 5) speed = 40; // clear roads

  let minutes = (distanceKm / speed) * 60;
  if (crossesBridge && weekday && hour >= 16 && hour <= 20) minutes += 35;
  else if (crossesBridge) minutes += 12;

  return Math.max(5, Math.round(minutes));
}

export function leaveByTime(kickoff: Date, travelMinutes: number): Date {
  // 10 minutes of buffer to change and get on the pitch
  return new Date(kickoff.getTime() - (travelMinutes + 10) * 60_000);
}
