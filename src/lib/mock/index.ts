import { getMatchState } from "@/lib/match";
import { distanceKm } from "@/lib/format";
import { venues } from "./venues";
import { pitches } from "./pitches";
import { games, buildParticipants } from "./games";
import { players } from "./players";
import type { Venue, Pitch, Game, GameParticipant, PlayerProfile, SkillLevel } from "@/lib/types";

/**
 * v2's stand-in for `lib/data/repo.ts` — same function names and shapes so
 * page components read identically to v1, but everything here is a plain
 * array lookup. No Supabase, no demo store, no `server-only` — this can be
 * imported from Client Components too.
 */

const participants = buildParticipants();

export interface PitchWithVenue extends Pitch {
  venue: Venue;
  distance?: number;
}

function hydratePitch(p: Pitch): PitchWithVenue {
  const venue = venues.find((v) => v.id === p.venueId)!;
  return { ...p, venue };
}

export interface PitchQuery {
  q?: string;
  area?: string;
  size?: string;
  surface?: string;
  maxPriceKobo?: number;
  sort?: "near" | "cheap" | "rated";
  origin?: { lat: number; lng: number };
}

export function listPitches(query: PitchQuery = {}): PitchWithVenue[] {
  const { q, area, size, surface, maxPriceKobo, sort = "near", origin } = query;

  let out = pitches.map(hydratePitch).filter((p) => {
    if (area && area !== "all" && p.venue.area !== area) return false;
    if (size && size !== "all" && p.size !== size) return false;
    if (surface && surface !== "all" && p.surface !== surface) return false;
    if (maxPriceKobo && p.pricePerHourKobo > maxPriceKobo) return false;
    if (q) {
      const hay = `${p.name} ${p.venue.name} ${p.venue.area} ${p.venue.address}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  if (origin) {
    out = out.map((p) => ({
      ...p,
      distance: distanceKm(origin, { lat: p.venue.lat, lng: p.venue.lng }),
    }));
  }

  const sorters: Record<string, (a: PitchWithVenue, b: PitchWithVenue) => number> = {
    near: (a, b) =>
      origin ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : (b.rating ?? 0) - (a.rating ?? 0),
    cheap: (a, b) => a.pricePerHourKobo - b.pricePerHourKobo,
    rated: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  };

  return [...out].sort(sorters[sort] ?? sorters.near);
}

export function getPitchBySlug(slug: string): PitchWithVenue | null {
  const p = pitches.find((x) => x.slug === slug);
  return p ? hydratePitch(p) : null;
}

export function listVenues(): Venue[] {
  return venues;
}

/* -------------------------------------------------------------------- games */

export interface GameFull extends Game {
  pitch: PitchWithVenue;
  host: PlayerProfile;
  participants: (GameParticipant & { player: PlayerProfile })[];
  filled: number;
}

function hydrateGame(g: Omit<Game, "participants" | "filled">): GameFull {
  const pitch = hydratePitch(pitches.find((p) => p.id === g.pitchId)!);
  const host = players.find((p) => p.id === g.hostId)!;
  const gameParticipants = participants
    .filter((p) => p.gameId === g.id && p.status !== "withdrawn")
    .map((p) => ({ ...p, player: players.find((x) => x.id === p.userId)! }))
    .filter((p) => Boolean(p.player))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

  return {
    ...g,
    pitch,
    host,
    participants: gameParticipants,
    filled: gameParticipants.filter((p) => p.status === "confirmed").length,
  };
}

export interface GameQuery {
  q?: string;
  level?: SkillLevel | "all";
  when?: "all" | "today" | "tomorrow" | "week";
  side?: "all" | "island" | "mainland";
}

export function listGames(query: GameQuery = {}): GameFull[] {
  const { q, level = "all", when = "all", side = "all" } = query;
  const all = games.map(hydrateGame);
  const now = Date.now();

  const startOfDay = (offset: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.getTime();
  };

  return all
    .filter((g) => {
      const start = new Date(g.startsAt).getTime();
      if (new Date(g.endsAt).getTime() < now) return false;
      if (level !== "all" && g.level !== level) return false;
      if (side !== "all" && g.pitch.venue.side !== side) return false;
      if (when === "today" && (start < startOfDay(0) || start >= startOfDay(1))) return false;
      if (when === "tomorrow" && (start < startOfDay(1) || start >= startOfDay(2))) return false;
      if (when === "week" && (start < startOfDay(0) || start >= startOfDay(7))) return false;
      if (q) {
        const hay =
          `${g.title} ${g.description} ${g.pitch.venue.name} ${g.pitch.venue.area} ${g.host.fullName}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getGameBySlug(slug: string): GameFull | null {
  const g = games.find((x) => x.slug === slug);
  return g ? hydrateGame(g) : null;
}

/* ----------------------------------------------------------------- players */

export function getProfile(handle: string): PlayerProfile | null {
  return players.find((p) => p.handle === handle) ?? null;
}

export function listProfiles(): PlayerProfile[] {
  return players;
}

export function getGamesForUser(userId: string): GameFull[] {
  const mine = new Set(
    participants.filter((p) => p.userId === userId && p.status !== "withdrawn").map((p) => p.gameId),
  );
  return games
    .filter((g) => mine.has(g.id) || g.hostId === userId)
    .map(hydrateGame)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** The mock "signed in" player — v2 has no auth, so the dashboard/nav just picks one. */
export function getCurrentUser(): PlayerProfile {
  return players[0];
}

/* -------------------------------------------------------------- aggregates */

export function getPlatformStats() {
  const upcoming = games.filter((g) => new Date(g.endsAt).getTime() > Date.now());
  const openSpots = upcoming.reduce((sum, g) => {
    const filled = participants.filter((p) => p.gameId === g.id && p.status === "confirmed").length;
    return sum + Math.max(0, g.capacity - filled);
  }, 0);

  return {
    verifiedVenues: venues.filter((v) => v.verified).length,
    pitches: pitches.length,
    upcomingGames: upcoming.length,
    openSpots,
    areas: new Set(venues.map((v) => v.area)).size,
  };
}

export function getUrgentGames(limit = 3): GameFull[] {
  return listGames()
    .map((g) => ({ g, state: getMatchState(g) }))
    .filter(({ state }) => !state.hasEnded && state.spotsLeft > 0)
    .sort((a, b) => a.state.msToKickoff - b.state.msToKickoff)
    .slice(0, limit)
    .map(({ g }) => g);
}

/** Distinct venue areas — powers the Footy-Addicts-style area footer. */
export function listAreas(): string[] {
  return Array.from(new Set(venues.map((v) => v.area))).sort();
}
