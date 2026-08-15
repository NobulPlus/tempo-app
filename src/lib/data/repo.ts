import "server-only";
import { store } from "./store";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { getMatchState } from "@/lib/match";
import { distanceKm, generateReference } from "@/lib/format";
import type {
  Venue,
  Pitch,
  Game,
  GameParticipant,
  PlayerProfile,
  Slot,
  Booking,
  SkillLevel,
} from "@/lib/types";

/**
 * The single data access layer for the app.
 *
 * Pages never touch Supabase or the demo store directly — they call these
 * functions. That way swapping the backend is a change in one file, and the
 * demo mode stays a first-class citizen rather than a hack bolted on the side.
 */

export function demoMode(): boolean {
  return !isSupabaseConfigured();
}

/* ------------------------------------------------------------------ pitches */

export interface PitchWithVenue extends Pitch {
  venue: Venue;
  distance?: number;
  nextOpenSlot?: Slot;
}

function hydratePitch(p: Pitch): PitchWithVenue {
  const s = store();
  const venue = s.venues.find((v) => v.id === p.venueId)!;
  const nextOpenSlot = s.slots
    .filter(
      (sl) =>
        sl.pitchId === p.id &&
        sl.status === "open" &&
        new Date(sl.startsAt).getTime() > Date.now(),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return { ...p, venue, nextOpenSlot };
}

export interface PitchQuery {
  q?: string;
  area?: string;
  size?: string;
  surface?: string;
  maxPriceKobo?: number;
  sort?: "near" | "cheap" | "rated" | "soonest";
  origin?: { lat: number; lng: number };
}

export async function listPitches(query: PitchQuery = {}): Promise<PitchWithVenue[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("pitches")
      .select("*, venue:venues(*)")
      .eq("active", true);
    // Filtering/sorting below is shared so behaviour matches demo mode exactly.
    return applyPitchQuery((data ?? []) as unknown as PitchWithVenue[], query);
  }

  const list = store().pitches.map(hydratePitch);
  return applyPitchQuery(list, query);
}

function applyPitchQuery(list: PitchWithVenue[], query: PitchQuery): PitchWithVenue[] {
  const { q, area, size, surface, maxPriceKobo, sort = "near", origin } = query;

  let out = list.filter((p) => {
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
    // Real distance sorting — the prototype's "Nearest" was array order.
    near: (a, b) =>
      origin
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity)
        : (b.rating ?? 0) - (a.rating ?? 0),
    cheap: (a, b) => a.pricePerHourKobo - b.pricePerHourKobo,
    rated: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
    soonest: (a, b) =>
      (a.nextOpenSlot?.startsAt ?? "9999").localeCompare(b.nextOpenSlot?.startsAt ?? "9999"),
  };

  return [...out].sort(sorters[sort] ?? sorters.near);
}

export async function getPitchBySlug(slug: string): Promise<PitchWithVenue | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("pitches")
      .select("*, venue:venues(*)")
      .eq("slug", slug)
      .maybeSingle();
    return (data as unknown as PitchWithVenue) ?? null;
  }
  const p = store().pitches.find((x) => x.slug === slug);
  return p ? hydratePitch(p) : null;
}

export async function getSlotsForPitch(pitchId: string, days = 7): Promise<Slot[]> {
  const horizon = Date.now() + days * 86_400_000;
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("slots")
      .select("*")
      .eq("pitch_id", pitchId)
      .order("during");
    return (data ?? []) as unknown as Slot[];
  }
  return store()
    .slots.filter(
      (s) =>
        s.pitchId === pitchId &&
        new Date(s.startsAt).getTime() > Date.now() &&
        new Date(s.startsAt).getTime() < horizon,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getSlot(id: string): Promise<(Slot & { pitch: PitchWithVenue }) | null> {
  const s = store();
  const slot = s.slots.find((x) => x.id === id);
  if (!slot) return null;
  const pitch = s.pitches.find((p) => p.id === slot.pitchId);
  if (!pitch) return null;
  return { ...slot, pitch: hydratePitch(pitch) };
}

/* -------------------------------------------------------------------- games */

export interface GameFull extends Game {
  pitch: PitchWithVenue;
  host: PlayerProfile;
  participants: (GameParticipant & { player: PlayerProfile })[];
  filled: number;
}

function hydrateGame(g: Omit<Game, "participants" | "filled">): GameFull {
  const s = store();
  const pitchRaw = s.pitches.find((p) => p.id === g.pitchId)!;
  const pitch = hydratePitch(pitchRaw);
  const host = s.profiles.find((p) => p.id === g.hostId)!;
  const participants = s.participants
    .filter((p) => p.gameId === g.id && p.status !== "withdrawn")
    .map((p) => ({ ...p, player: s.profiles.find((x) => x.id === p.userId)! }))
    .filter((p) => Boolean(p.player))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

  return {
    ...g,
    pitch,
    host,
    participants,
    filled: participants.filter((p) => p.status === "confirmed").length,
  };
}

export interface GameQuery {
  q?: string;
  level?: SkillLevel | "all";
  when?: "all" | "today" | "tomorrow" | "week";
  side?: "all" | "island" | "mainland";
  includeePast?: boolean;
}

export async function listGames(query: GameQuery = {}): Promise<GameFull[]> {
  const { q, level = "all", when = "all", side = "all" } = query;
  const all = store().games.map(hydrateGame);
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
      if (!query.includeePast && new Date(g.endsAt).getTime() < now) return false;
      if (level !== "all" && g.level !== level) return false;
      if (side !== "all" && g.pitch.venue.side !== side) return false;

      // A real date filter — the prototype's "This Week" silently matched everything.
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

export async function getGameBySlug(slug: string): Promise<GameFull | null> {
  const g = store().games.find((x) => x.slug === slug);
  return g ? hydrateGame(g) : null;
}

export async function getGameById(id: string): Promise<GameFull | null> {
  const g = store().games.find((x) => x.id === id);
  return g ? hydrateGame(g) : null;
}

/* --------------------------------------------------------------- mutations */

export type JoinResult =
  | { ok: true; status: "confirmed" | "waitlist" }
  | { ok: false; error: string };

/**
 * Join a game. In Supabase mode this calls the `join_game` RPC, which locks
 * the game row so two people cannot take the last spot simultaneously.
 */
export async function joinGame(gameId: string, userId: string): Promise<JoinResult> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("join_game", { p_game_id: gameId });
    if (error) return { ok: false, error: error.message };
    return { ok: true, status: (data as { status: "confirmed" | "waitlist" }).status };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  if (new Date(game.startsAt).getTime() <= Date.now())
    return { ok: false, error: "That game has already kicked off." };

  const existing = s.participants.find((p) => p.gameId === gameId && p.userId === userId);
  if (existing && existing.status !== "withdrawn")
    return { ok: false, error: "You're already in this game." };

  const confirmed = s.participants.filter(
    (p) => p.gameId === gameId && p.status === "confirmed",
  ).length;
  const status: GameParticipant["status"] =
    confirmed >= game.capacity ? "waitlist" : "confirmed";

  if (existing) {
    existing.status = status;
    existing.joinedAt = new Date().toISOString();
  } else {
    s.participants.push({
      id: `gp-${gameId}-${userId}-${Date.now()}`,
      gameId,
      userId,
      joinedAt: new Date().toISOString(),
      paidKobo: game.pricePerPlayerKobo,
      status,
    });
  }

  if (status === "confirmed" && confirmed + 1 >= game.capacity) game.status = "locked";
  return { ok: true, status };
}

export async function leaveGame(gameId: string, userId: string): Promise<{ ok: boolean }> {
  if (!demoMode()) {
    const sb = await createClient();
    await sb.rpc("leave_game", { p_game_id: gameId });
    return { ok: true };
  }

  const s = store();
  const mine = s.participants.find((p) => p.gameId === gameId && p.userId === userId);
  if (mine) mine.status = "withdrawn";

  // Promote the first person off the waitlist — the feature the prototype
  // advertised but never built.
  const next = s.participants
    .filter((p) => p.gameId === gameId && p.status === "waitlist")
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
  if (next) next.status = "confirmed";
  else {
    const game = s.games.find((g) => g.id === gameId);
    if (game && game.status === "locked") game.status = "open";
  }
  return { ok: true };
}

export async function createBooking(
  slotId: string,
  userId: string,
  paymentMethod: Booking["paymentMethod"],
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const s = store();
  const slot = s.slots.find((x) => x.id === slotId);
  if (!slot) return { ok: false, error: "That slot no longer exists." };
  if (slot.status !== "open")
    return { ok: false, error: "Sorry — someone just took that slot." };
  if (new Date(slot.startsAt).getTime() <= Date.now())
    return { ok: false, error: "That time has already passed." };

  slot.status = "booked";
  const booking: Booking = {
    id: `b-${Date.now()}`,
    reference: generateReference(),
    slotId,
    userId,
    status: "confirmed",
    totalKobo: slot.priceKobo,
    paidKobo: slot.priceKobo,
    paymentMethod,
    createdAt: new Date().toISOString(),
  };
  s.bookings.push(booking);
  return { ok: true, booking };
}

export async function getBookingByReference(
  reference: string,
): Promise<(Booking & { slot: Slot & { pitch: PitchWithVenue } }) | null> {
  const s = store();
  const b = s.bookings.find((x) => x.reference === reference);
  if (!b) return null;
  const slot = await getSlot(b.slotId);
  if (!slot) return null;
  return { ...b, slot };
}

export async function getBookingsForUser(userId: string) {
  const s = store();
  const rows = s.bookings.filter((b) => b.userId === userId);
  return Promise.all(
    rows.map(async (b) => ({ ...b, slot: await getSlot(b.slotId) })),
  );
}

/* ----------------------------------------------------------------- players */

export async function getProfile(handle: string): Promise<PlayerProfile | null> {
  return store().profiles.find((p) => p.handle === handle) ?? null;
}

export async function getProfileById(id: string): Promise<PlayerProfile | null> {
  return store().profiles.find((p) => p.id === id) ?? null;
}

export async function listProfiles(): Promise<PlayerProfile[]> {
  return store().profiles;
}

export async function getGamesForUser(userId: string): Promise<GameFull[]> {
  const s = store();
  const mine = new Set(
    s.participants.filter((p) => p.userId === userId && p.status !== "withdrawn").map((p) => p.gameId),
  );
  return s.games
    .filter((g) => mine.has(g.id) || g.hostId === userId)
    .map(hydrateGame)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/* ------------------------------------------------------------------ venues */

export async function listVenues(): Promise<Venue[]> {
  return store().venues;
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  return store().venues.find((v) => v.slug === slug) ?? null;
}

export async function getVenueStats(venueId: string) {
  const s = store();
  const pitchIds = s.pitches.filter((p) => p.venueId === venueId).map((p) => p.id);
  const slots = s.slots.filter((sl) => pitchIds.includes(sl.pitchId));
  const upcoming = slots.filter((sl) => new Date(sl.startsAt).getTime() > Date.now());
  const booked = upcoming.filter((sl) => sl.status === "booked");
  const revenueKobo = booked.reduce((sum, sl) => sum + sl.priceKobo, 0);
  const games = s.games.filter((g) => pitchIds.includes(g.pitchId));

  return {
    pitchCount: pitchIds.length,
    upcomingSlots: upcoming.length,
    bookedSlots: booked.length,
    utilisation: upcoming.length ? Math.round((booked.length / upcoming.length) * 100) : 0,
    projectedRevenueKobo: revenueKobo,
    gamesHosted: games.length,
  };
}

/* -------------------------------------------------------------- aggregates */

/** Honest platform numbers, computed — never invented. */
export async function getPlatformStats() {
  const s = store();
  const verifiedVenues = s.venues.filter((v) => v.verified).length;
  const upcoming = s.games.filter((g) => new Date(g.endsAt).getTime() > Date.now());
  const openSpots = upcoming.reduce((sum, g) => {
    const filled = s.participants.filter(
      (p) => p.gameId === g.id && p.status === "confirmed",
    ).length;
    return sum + Math.max(0, g.capacity - filled);
  }, 0);

  return {
    verifiedVenues,
    pitches: s.pitches.length,
    upcomingGames: upcoming.length,
    openSpots,
    areas: new Set(s.venues.map((v) => v.area)).size,
  };
}

/** Games closest to kickoff that still need players — the homepage hook. */
export async function getUrgentGames(limit = 3): Promise<GameFull[]> {
  const all = await listGames();
  return all
    .map((g) => ({ g, state: getMatchState(g) }))
    .filter(({ state }) => !state.hasEnded && state.spotsLeft > 0)
    .sort((a, b) => a.state.msToKickoff - b.state.msToKickoff)
    .slice(0, limit)
    .map(({ g }) => g);
}
