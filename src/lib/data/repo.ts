import "server-only";
import { store } from "./store";
import { camelize } from "./case";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { getMatchState } from "@/lib/match";
import { distanceKm, generateReference, initialsOf, slugify } from "@/lib/format";
import type {
  Venue,
  Pitch,
  Game,
  GameParticipant,
  PlayerProfile,
  Slot,
  Booking,
  SkillLevel,
  WaitlistLead,
  PitchSize,
  PitchSurface,
  WalletTransaction,
} from "@/lib/types";

/** The shape a `profiles` row has right after `camelize` — flat trait_*
 * columns, no `initials` column at all (only ever hand-set in seed data). */
interface RawProfileRow extends Omit<PlayerProfile, "initials" | "traits" | "joinedAt"> {
  /** The column is `created_at` — there is no `joined_at` in the schema. */
  createdAt: string;
  traitPace: number;
  traitPassing: number;
  traitFinishing: number;
  traitDefending: number;
  traitStamina: number;
  traitTeamwork: number;
}

/**
 * Postgres stores traits as flat trait_pace/trait_passing/... columns and
 * has no `initials` column at all (v1's seed data set it by hand). This is
 * the one place a raw profiles row becomes a real PlayerProfile. Idempotent
 * on already-camelCased input, so it's safe to call again on a sub-object
 * a parent mapper already ran through `camelize`.
 */
export function mapProfileRow(row: Record<string, unknown>): PlayerProfile {
  const c = camelize<RawProfileRow>(row);
  return {
    ...c,
    joinedAt: c.createdAt,
    initials: initialsOf(c.fullName),
    traits: {
      pace: c.traitPace,
      passing: c.traitPassing,
      finishing: c.traitFinishing,
      defending: c.traitDefending,
      stamina: c.traitStamina,
      teamwork: c.traitTeamwork,
    },
  } as PlayerProfile;
}

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

const PITCH_SELECT = "*, venue:venues(*)";

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
    const { data } = await sb.from("pitches").select(PITCH_SELECT).eq("active", true);
    // Filtering/sorting below is shared so behaviour matches demo mode exactly.
    return applyPitchQuery(camelize<PitchWithVenue[]>(data ?? []), query);
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
    const { data } = await sb.from("pitches").select(PITCH_SELECT).eq("slug", slug).maybeSingle();
    return data ? camelize<PitchWithVenue>(data) : null;
  }
  const p = store().pitches.find((x) => x.slug === slug);
  return p ? hydratePitch(p) : null;
}

export async function getPitchById(id: string): Promise<PitchWithVenue | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("pitches").select(PITCH_SELECT).eq("id", id).maybeSingle();
    return data ? camelize<PitchWithVenue>(data) : null;
  }
  const p = store().pitches.find((x) => x.id === id);
  return p ? hydratePitch(p) : null;
}

export async function getPitchesForVenue(venueId: string): Promise<Pitch[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("pitches").select("*").eq("venue_id", venueId);
    return camelize<Pitch[]>(data ?? []);
  }
  return store().pitches.filter((p) => p.venueId === venueId);
}

export interface CreatePitchInput {
  name: string;
  size: PitchSize;
  surface: PitchSurface;
  floodlights: boolean;
  covered: boolean;
  pricePerHourKobo: number;
  peakMultiplier: number;
}

export async function createPitch(
  venueId: string,
  input: CreatePitchInput,
): Promise<{ ok: true; pitch: Pitch } | { ok: false; error: string }> {
  const slug = slugify(input.name);

  if (demoMode()) {
    const pitch: Pitch = {
      id: `p-${Date.now()}`,
      venueId,
      slug,
      name: input.name,
      size: input.size,
      surface: input.surface,
      floodlights: input.floodlights,
      covered: input.covered,
      pricePerHourKobo: input.pricePerHourKobo,
      peakMultiplier: input.peakMultiplier,
      rating: 0,
      reviewCount: 0,
      active: true,
    };
    store().pitches.push(pitch);
    return { ok: true, pitch };
  }

  const sb = await createClient();
  const { data, error } = await sb
    .from("pitches")
    .insert({
      venue_id: venueId,
      slug,
      name: input.name,
      size: input.size,
      surface: input.surface,
      floodlights: input.floodlights,
      covered: input.covered,
      price_per_hour_kobo: input.pricePerHourKobo,
      peak_multiplier: input.peakMultiplier,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, pitch: camelize<Pitch>(data) };
}

export interface UpdatePitchInput {
  name?: string;
  pricePerHourKobo?: number;
  peakMultiplier?: number;
  floodlights?: boolean;
  covered?: boolean;
  active?: boolean;
}

export async function updatePitch(
  pitchId: string,
  input: UpdatePitchInput,
): Promise<{ ok: boolean; error?: string }> {
  if (demoMode()) {
    const p = store().pitches.find((x) => x.id === pitchId);
    if (!p) return { ok: false, error: "Pitch not found." };
    Object.assign(p, input);
    return { ok: true };
  }

  const sb = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.pricePerHourKobo !== undefined) patch.price_per_hour_kobo = input.pricePerHourKobo;
  if (input.peakMultiplier !== undefined) patch.peak_multiplier = input.peakMultiplier;
  if (input.floodlights !== undefined) patch.floodlights = input.floodlights;
  if (input.covered !== undefined) patch.covered = input.covered;
  if (input.active !== undefined) patch.active = input.active;

  const { error } = await sb.from("pitches").update(patch).eq("id", pitchId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getSlotsForPitch(pitchId: string, days = 7): Promise<Slot[]> {
  const horizon = Date.now() + days * 86_400_000;
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("slots")
      .select("*")
      .eq("pitch_id", pitchId)
      .gte("starts_at", new Date().toISOString())
      .lte("starts_at", new Date(horizon).toISOString())
      .order("starts_at");
    return camelize<Slot[]>(data ?? []);
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

export interface GenerateSlotsRules {
  openHour: number;
  closeHour: number;
  daysAhead: number;
  peakStartHour: number;
  peakEndHour: number;
}

/**
 * Same loop scripts/seed.mjs uses (N days x an hourly window, weekday-
 * evening peak pricing), parameterized instead of hardcoded. Pre-filters
 * against slots that already exist for this pitch rather than relying on
 * the database to reject conflicts — a single exclusion-constraint
 * violation in a multi-row insert rolls back the *whole* insert, which
 * would otherwise silently drop every valid new slot the moment a venue
 * owner re-runs this to extend coverage into a range that already
 * partially exists.
 */
export async function generateSlots(
  pitchId: string,
  basePriceKobo: number,
  peakMultiplier: number,
  rules: GenerateSlotsRules,
): Promise<{ ok: boolean; created: number; error?: string }> {
  const { openHour, closeHour, daysAhead, peakStartHour, peakEndHour } = rules;
  const now = new Date();
  const candidates: { startsAt: Date; endsAt: Date; priceKobo: number }[] = [];

  for (let d = 0; d < daysAhead; d++) {
    for (let h = openHour; h <= closeHour; h++) {
      const start = new Date(now);
      start.setDate(start.getDate() + d);
      start.setHours(h, 0, 0, 0);
      if (start <= now) continue;

      const end = new Date(start.getTime() + 3_600_000);
      const dow = start.getDay();
      const peak = dow >= 1 && dow <= 5 && h >= peakStartHour && h <= peakEndHour;
      const priceKobo = Math.round(basePriceKobo * (peak ? peakMultiplier : 1));
      candidates.push({ startsAt: start, endsAt: end, priceKobo });
    }
  }
  if (candidates.length === 0) return { ok: true, created: 0 };

  const existing = await getSlotsForPitch(pitchId, daysAhead + 1);
  const existingStarts = new Set(existing.map((s) => s.startsAt));
  const rows = candidates.filter((c) => !existingStarts.has(c.startsAt.toISOString()));
  if (rows.length === 0) return { ok: true, created: 0 };

  if (demoMode()) {
    const s = store();
    for (const row of rows) {
      s.slots.push({
        id: `sl-${pitchId}-${row.startsAt.getTime()}`,
        pitchId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        priceKobo: row.priceKobo,
        status: "open",
      });
    }
    return { ok: true, created: rows.length };
  }

  const sb = await createClient();
  const { error } = await sb.from("slots").insert(
    rows.map((row) => ({
      pitch_id: pitchId,
      during: `[${row.startsAt.toISOString()},${row.endsAt.toISOString()})`,
      price_kobo: row.priceKobo,
      status: "open",
    })),
  );
  if (error) return { ok: false, created: 0, error: error.message };
  return { ok: true, created: rows.length };
}

/** The "block this hour for maintenance" primitive. */
export async function setSlotStatus(
  slotId: string,
  status: "open" | "blocked",
): Promise<{ ok: boolean; error?: string }> {
  if (demoMode()) {
    const slot = store().slots.find((s) => s.id === slotId);
    if (!slot) return { ok: false, error: "Slot not found." };
    slot.status = status;
    return { ok: true };
  }

  const sb = await createClient();
  const { error } = await sb.from("slots").update({ status }).eq("id", slotId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getSlot(id: string): Promise<(Slot & { pitch: PitchWithVenue }) | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("slots")
      .select(`*, pitch:pitches(${PITCH_SELECT})`)
      .eq("id", id)
      .maybeSingle();
    return data ? camelize<Slot & { pitch: PitchWithVenue }>(data) : null;
  }
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

const GAME_SELECT = `*, pitch:pitches(${PITCH_SELECT}), host:profiles(*), game_participants(*, player:profiles(*))`;

interface RawParticipantRow extends Omit<GameParticipant, "player"> {
  player: Record<string, unknown>;
}

interface RawGameRow extends Omit<Game, "participants" | "filled" | "host" | "pitch"> {
  pitch: PitchWithVenue;
  host: Record<string, unknown>;
  gameParticipants?: RawParticipantRow[];
}

/** Reshapes a raw `games` row (with embedded pitch/host/participants) into
 * a GameFull — the real-mode counterpart to `hydrateGame` below. */
function mapGameRow(row: Record<string, unknown>): GameFull {
  const c = camelize<RawGameRow>(row);
  const participants = (c.gameParticipants ?? [])
    .filter((p) => p.status !== "withdrawn")
    .map((p) => ({ ...p, player: mapProfileRow(p.player) }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

  return {
    ...c,
    host: mapProfileRow(c.host),
    participants,
    filled: participants.filter((p) => p.status === "confirmed").length,
  };
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
  const all = !demoMode()
    ? await (async () => {
        const sb = await createClient();
        const { data } = await sb.from("games").select(GAME_SELECT);
        return (data ?? []).map(mapGameRow);
      })()
    : store().games.map(hydrateGame);

  return applyGameQuery(all, query);
}

function applyGameQuery(all: GameFull[], query: GameQuery): GameFull[] {
  const { q, level = "all", when = "all", side = "all" } = query;
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
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("games").select(GAME_SELECT).eq("slug", slug).maybeSingle();
    return data ? mapGameRow(data) : null;
  }
  const g = store().games.find((x) => x.slug === slug);
  return g ? hydrateGame(g) : null;
}

export async function getGameById(id: string): Promise<GameFull | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("games").select(GAME_SELECT).eq("id", id).maybeSingle();
    return data ? mapGameRow(data) : null;
  }
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

export async function leaveGame(
  gameId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { error } = await sb.rpc("leave_game", { p_game_id: gameId });
    if (error) return { ok: false, error: error.message };
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

/** 5% service fee. The real source of truth is create_booking() in
 * supabase/migrations/0006_create_booking.sql, which computes the same rate
 * independently in SQL — this is for display, and must stay in sync. */
export const SERVICE_FEE_RATE = 0.05;

export function computeBookingTotal(priceKobo: number): { feeKobo: number; totalKobo: number } {
  const feeKobo = Math.round(priceKobo * SERVICE_FEE_RATE);
  return { feeKobo, totalKobo: priceKobo + feeKobo };
}

const BOOKING_SELECT = `*, slot:slots(*, pitch:pitches(${PITCH_SELECT}))`;

function mapBookingRow(row: Record<string, unknown>): Booking & { slot: Slot & { pitch: PitchWithVenue } } {
  return camelize<Booking & { slot: Slot & { pitch: PitchWithVenue } }>(row);
}

export async function createBooking(
  slotId: string,
  userId: string,
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("create_booking", { p_slot_id: slotId });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("no longer available")
          ? "Sorry — someone just took that slot."
          : error.message.includes("insufficient wallet balance")
            ? "Not enough wallet balance for this booking."
            : error.message,
      };
    }
    return { ok: true, booking: camelize<Booking>(data) };
  }

  const s = store();
  const slot = s.slots.find((x) => x.id === slotId);
  if (!slot) return { ok: false, error: "That slot no longer exists." };
  if (slot.status !== "open")
    return { ok: false, error: "Sorry — someone just took that slot." };
  if (new Date(slot.startsAt).getTime() <= Date.now())
    return { ok: false, error: "That time has already passed." };

  const { totalKobo } = computeBookingTotal(slot.priceKobo);
  const balance = s.wallets[userId] ?? 0;
  if (balance < totalKobo) {
    return { ok: false, error: "Not enough wallet balance for this booking." };
  }

  slot.status = "booked";
  s.wallets[userId] = balance - totalKobo;

  const booking: Booking = {
    id: `b-${Date.now()}`,
    reference: generateReference(),
    slotId,
    userId,
    status: "confirmed",
    totalKobo,
    paidKobo: totalKobo,
    paymentMethod: "wallet",
    createdAt: new Date().toISOString(),
  };
  s.bookings.push(booking);

  s.walletTransactions.push({
    id: `wt-${Date.now()}`,
    userId,
    type: "booking_payment",
    status: "completed",
    amountKobo: -totalKobo,
    balanceAfterKobo: s.wallets[userId],
    reference: `PAY-${booking.reference}`,
    provider: "wallet",
    providerRef: null,
    bookingId: booking.id,
    createdAt: new Date().toISOString(),
  });

  return { ok: true, booking };
}

/** 6-hour cutoff, matching /legal/refunds exactly: 6h+ before kickoff credits
 * the wallet in full; under 6h forfeits it. Either way the slot reopens. */
export async function cancelBooking(
  bookingId: string,
  userId: string,
): Promise<{ ok: true; booking: Booking; creditedKobo: number } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("cancel_booking", { p_booking_id: bookingId });
    if (error) return { ok: false, error: error.message };
    const booking = camelize<Booking>(data);
    const { data: creditRows } = await sb
      .from("wallet_transactions")
      .select("amount_kobo")
      .eq("booking_id", booking.id)
      .eq("type", "cancellation_credit")
      .eq("status", "completed");
    const creditedKobo = (creditRows ?? []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.amount_kobo ?? 0)),
      0,
    );
    return { ok: true, booking, creditedKobo };
  }

  const s = store();
  const booking = s.bookings.find((b) => b.id === bookingId && b.userId === userId);
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status !== "confirmed") return { ok: false, error: "Booking cannot be cancelled." };

  const slot = s.slots.find((x) => x.id === booking.slotId);
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const creditedKobo =
    slot && new Date(slot.startsAt).getTime() - Date.now() >= sixHoursMs ? booking.paidKobo : 0;

  booking.status = "cancelled";
  if (slot) slot.status = "open";

  if (creditedKobo > 0) {
    const balance = (s.wallets[userId] ?? 0) + creditedKobo;
    s.wallets[userId] = balance;
    s.walletTransactions.push({
      id: `wt-${Date.now()}`,
      userId,
      type: "cancellation_credit",
      status: "completed",
      amountKobo: creditedKobo,
      balanceAfterKobo: balance,
      reference: `CRD-${booking.reference}`,
      provider: null,
      providerRef: null,
      bookingId: booking.id,
      createdAt: new Date().toISOString(),
    });
  }

  return { ok: true, booking, creditedKobo };
}

export async function getWalletBalance(userId: string): Promise<number> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("wallets")
      .select("balance_kobo")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.balance_kobo ?? 0;
  }
  return store().wallets[userId] ?? 0;
}

export async function getWalletTransactions(userId: string, limit = 20): Promise<WalletTransaction[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return camelize<WalletTransaction[]>(data ?? []);
  }
  return store()
    .walletTransactions.filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getBookingByReference(
  reference: string,
): Promise<(Booking & { slot: Slot & { pitch: PitchWithVenue } }) | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("reference", reference)
      .maybeSingle();
    return data ? mapBookingRow(data) : null;
  }
  const s = store();
  const b = s.bookings.find((x) => x.reference === reference);
  if (!b) return null;
  const slot = await getSlot(b.slotId);
  if (!slot) return null;
  return { ...b, slot };
}

export async function getBookingsForUser(userId: string) {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map(mapBookingRow);
  }
  const s = store();
  const rows = s.bookings.filter((b) => b.userId === userId);
  return Promise.all(
    rows.map(async (b) => ({ ...b, slot: await getSlot(b.slotId) })),
  );
}

/* ----------------------------------------------------------------- players */

export async function getProfile(handle: string): Promise<PlayerProfile | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("profiles").select("*").eq("handle", handle).maybeSingle();
    return data ? mapProfileRow(data) : null;
  }
  return store().profiles.find((p) => p.handle === handle) ?? null;
}

export async function getProfileById(id: string): Promise<PlayerProfile | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
    return data ? mapProfileRow(data) : null;
  }
  return store().profiles.find((p) => p.id === id) ?? null;
}

export async function listProfiles(): Promise<PlayerProfile[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("profiles").select("*");
    return (data ?? []).map(mapProfileRow);
  }
  return store().profiles;
}

/**
 * Admin-only. Live mode only — joinWaitlist()/joinPartnerWaitlist() only
 * ever write to Postgres when Supabase is configured, so there's nothing to
 * list in demo mode.
 */
export async function listWaitlist(): Promise<WaitlistLead[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data } = await sb
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });
  return camelize<WaitlistLead[]>(data ?? []);
}

export async function getGamesForUser(userId: string): Promise<GameFull[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const [{ data: hosted }, { data: joined }] = await Promise.all([
      sb.from("games").select(GAME_SELECT).eq("host_id", userId),
      sb
        .from("game_participants")
        .select(`game:games(${GAME_SELECT})`)
        .eq("user_id", userId)
        .neq("status", "withdrawn"),
    ]);

    const byId = new Map<string, Record<string, unknown>>();
    (hosted ?? []).forEach((g: Record<string, unknown>) => byId.set(g.id as string, g));
    const joinedRows = (joined ?? []) as unknown as { game: Record<string, unknown> | null }[];
    joinedRows.forEach((row) => {
      if (row.game) byId.set(row.game.id as string, row.game);
    });

    return Array.from(byId.values())
      .map(mapGameRow)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

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
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("venues").select("*");
    return camelize<Venue[]>(data ?? []);
  }
  return store().venues;
}

export interface CreateVenueInput {
  name: string;
  area: string;
  side: "island" | "mainland";
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  description?: string;
}

/**
 * Self-serve venue creation. venues_write is a full `for all using
 * (auth.uid() = owner_id)` policy that already covers insert, so — same
 * reasoning as verifyVenue() below — this is a plain insert, no RPC needed.
 * New venues start unverified; the admin verification queue built in the
 * prior pass is the review gate before a venue is publicly bookable.
 */
export async function createVenue(
  ownerId: string,
  input: CreateVenueInput,
): Promise<{ ok: true; venue: Venue } | { ok: false; error: string }> {
  const slug = slugify(input.name);

  if (demoMode()) {
    const venue: Venue = {
      id: `v-${Date.now()}`,
      slug,
      name: input.name,
      area: input.area,
      side: input.side,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      verified: false,
      verifiedAt: null,
      phone: input.phone ?? null,
      amenities: [],
      photos: [],
      description: input.description ?? "",
      ownerId,
      createdAt: new Date().toISOString(),
    };
    store().venues.push(venue);
    return { ok: true, venue };
  }

  const sb = await createClient();
  const { data, error } = await sb
    .from("venues")
    .insert({
      slug,
      name: input.name,
      area: input.area,
      side: input.side,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      phone: input.phone || null,
      description: input.description || "",
      owner_id: ownerId,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, venue: camelize<Venue>(data) };
}

export interface UpdateVenueInput {
  name?: string;
  area?: string;
  side?: "island" | "mainland";
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string | null;
  description?: string;
}

export async function updateVenue(
  venueId: string,
  input: UpdateVenueInput,
): Promise<{ ok: boolean; error?: string }> {
  if (demoMode()) {
    const v = store().venues.find((x) => x.id === venueId);
    if (!v) return { ok: false, error: "Venue not found." };
    Object.assign(v, input);
    return { ok: true };
  }

  const sb = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.area !== undefined) patch.area = input.area;
  if (input.side !== undefined) patch.side = input.side;
  if (input.address !== undefined) patch.address = input.address;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.description !== undefined) patch.description = input.description;

  const { error } = await sb.from("venues").update(patch).eq("id", venueId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Admin-only. venues_admin_all is a full `for all using (is_admin())`
 * policy (unlike profiles, which locked down direct UPDATE with column
 * grants), so this is a plain update — no dedicated RPC needed. RLS itself
 * is what actually stops a non-admin from calling this successfully.
 */
export async function verifyVenue(
  venueId: string,
  adminId: string,
  verified: boolean,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };

  const sb = await createClient();
  const { error } = await sb
    .from("venues")
    .update({
      verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? adminId : null,
      verification_note: note || null,
    })
    .eq("id", venueId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("venues").select("*").eq("slug", slug).maybeSingle();
    return data ? camelize<Venue>(data) : null;
  }
  return store().venues.find((v) => v.slug === slug) ?? null;
}

export async function getVenueById(id: string): Promise<Venue | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("venues").select("*").eq("id", id).maybeSingle();
    return data ? camelize<Venue>(data) : null;
  }
  return store().venues.find((v) => v.id === id) ?? null;
}

/** Distinct venue areas — powers the area-based footer. */
export async function listAreas(): Promise<string[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("venues").select("area");
    return Array.from(new Set((data ?? []).map((v) => v.area as string))).sort();
  }
  return Array.from(new Set(store().venues.map((v) => v.area))).sort();
}

export async function getVenueStats(venueId: string) {
  if (!demoMode()) {
    const sb = await createClient();
    const { data: pitchRows } = await sb.from("pitches").select("id").eq("venue_id", venueId);
    const pitchIds = (pitchRows ?? []).map((p) => p.id as string);
    if (pitchIds.length === 0) {
      return { pitchCount: 0, upcomingSlots: 0, bookedSlots: 0, utilisation: 0, projectedRevenueKobo: 0, gamesHosted: 0 };
    }

    const nowIso = new Date().toISOString();
    const [{ data: upcomingRows }, { count: gamesHosted }] = await Promise.all([
      sb.from("slots").select("status, price_kobo").in("pitch_id", pitchIds).gte("starts_at", nowIso),
      sb.from("games").select("id", { count: "exact", head: true }).in("pitch_id", pitchIds),
    ]);

    const upcoming = upcomingRows ?? [];
    const booked = upcoming.filter((s) => s.status === "booked");
    const revenueKobo = booked.reduce((sum, s) => sum + (s.price_kobo as number), 0);

    return {
      pitchCount: pitchIds.length,
      upcomingSlots: upcoming.length,
      bookedSlots: booked.length,
      utilisation: upcoming.length ? Math.round((booked.length / upcoming.length) * 100) : 0,
      projectedRevenueKobo: revenueKobo,
      gamesHosted: gamesHosted ?? 0,
    };
  }

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
  if (!demoMode()) {
    const sb = await createClient();
    const nowIso = new Date().toISOString();

    const [{ count: verifiedVenues }, { count: pitches }, { data: upcomingGameRows }, { data: venueAreaRows }] =
      await Promise.all([
        sb.from("venues").select("id", { count: "exact", head: true }).eq("verified", true),
        sb.from("pitches").select("id", { count: "exact", head: true }).eq("active", true),
        sb.from("games").select("id, capacity, game_participants(status)").gte("ends_at", nowIso),
        sb.from("venues").select("area"),
      ]);

    const openSpots = (upcomingGameRows ?? []).reduce(
      (sum, g: { capacity: number; game_participants: { status: string }[] | null }) => {
        const filled = (g.game_participants ?? []).filter((p) => p.status === "confirmed").length;
        return sum + Math.max(0, g.capacity - filled);
      },
      0,
    );

    return {
      verifiedVenues: verifiedVenues ?? 0,
      pitches: pitches ?? 0,
      upcomingGames: (upcomingGameRows ?? []).length,
      openSpots,
      areas: new Set((venueAreaRows ?? []).map((v: { area: string }) => v.area)).size,
    };
  }

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
