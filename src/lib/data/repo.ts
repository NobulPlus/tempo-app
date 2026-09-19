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
  HostBankAccount,
  HostPayoutRequest,
  VenueVerificationEvent,
  IdentityVerification,
  KycStatus,
  VenueOwnerApplication,
  GameChatMessage,
  DmThread,
  DmMessage,
  MessageReport,
  MessageReportSource,
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
  resourceType?: string;
  activityType?: string;
  supportedActivities?: string[];
  size: PitchSize;
  surface: PitchSurface;
  floodlights: boolean;
  covered: boolean;
  photos?: string[];
  amenities?: string[];
  capacity?: number | null;
  recommendedPlayers?: number | null;
  description?: string;
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
      resourceType: input.resourceType ?? "pitch",
      activityType: input.activityType ?? "football",
      supportedActivities: input.supportedActivities ?? [input.activityType ?? "football"],
      size: input.size,
      surface: input.surface,
      floodlights: input.floodlights,
      covered: input.covered,
      photos: input.photos ?? [],
      amenities: input.amenities ?? [],
      capacity: input.capacity ?? null,
      recommendedPlayers: input.recommendedPlayers ?? null,
      description: input.description ?? "",
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
      resource_type: input.resourceType ?? "pitch",
      activity_type: input.activityType ?? "football",
      supported_activities: input.supportedActivities ?? [input.activityType ?? "football"],
      size: input.size,
      surface: input.surface,
      floodlights: input.floodlights,
      covered: input.covered,
      photos: input.photos ?? [],
      amenities: input.amenities ?? [],
      capacity: input.capacity ?? null,
      recommended_players: input.recommendedPlayers ?? null,
      description: input.description ?? "",
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
  resourceType?: string;
  activityType?: string;
  supportedActivities?: string[];
  size?: PitchSize;
  surface?: PitchSurface;
  pricePerHourKobo?: number;
  peakMultiplier?: number;
  floodlights?: boolean;
  covered?: boolean;
  photos?: string[];
  amenities?: string[];
  capacity?: number | null;
  recommendedPlayers?: number | null;
  description?: string;
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
  if (input.resourceType !== undefined) patch.resource_type = input.resourceType;
  if (input.activityType !== undefined) patch.activity_type = input.activityType;
  if (input.supportedActivities !== undefined) patch.supported_activities = input.supportedActivities;
  if (input.size !== undefined) patch.size = input.size;
  if (input.surface !== undefined) patch.surface = input.surface;
  if (input.pricePerHourKobo !== undefined) patch.price_per_hour_kobo = input.pricePerHourKobo;
  if (input.peakMultiplier !== undefined) patch.peak_multiplier = input.peakMultiplier;
  if (input.floodlights !== undefined) patch.floodlights = input.floodlights;
  if (input.covered !== undefined) patch.covered = input.covered;
  if (input.photos !== undefined) patch.photos = input.photos;
  if (input.amenities !== undefined) patch.amenities = input.amenities;
  if (input.capacity !== undefined) patch.capacity = input.capacity;
  if (input.recommendedPlayers !== undefined) patch.recommended_players = input.recommendedPlayers;
  if (input.description !== undefined) patch.description = input.description;
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
  daysAhead: number;
  slotDurationMinutes?: number;
  bufferMinutes?: number;
  rules?: WeeklySlotRule[];
  /** Legacy single-rule fields kept for older callers and demo scripts. */
  openHour?: number;
  closeHour?: number;
  peakStartHour?: number;
  peakEndHour?: number;
  daysOfWeek?: number[];
  weekendMultiplier?: number;
}

export interface WeeklySlotRule {
  name?: string;
  daysOfWeek: number[];
  openMinutes: number;
  closeMinutes: number;
  basePriceKobo: number;
  peakStartMinutes?: number | null;
  peakEndMinutes?: number | null;
  peakPriceKobo?: number | null;
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
): Promise<{ ok: boolean; created: number; skipped: number; candidates: number; error?: string }> {
  const {
    daysAhead,
    slotDurationMinutes = 60,
    bufferMinutes = 0,
  } = rules;

  const weeklyRules = rules.rules?.length
    ? rules.rules
    : [
        {
          daysOfWeek: rules.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
          openMinutes: (rules.openHour ?? 6) * 60,
          closeMinutes: (rules.closeHour ?? 21) * 60,
          basePriceKobo,
          peakStartMinutes: (rules.peakStartHour ?? 17) * 60,
          peakEndMinutes: (rules.peakEndHour ?? 20) * 60,
          peakPriceKobo: Math.round(basePriceKobo * peakMultiplier),
        },
      ];

  const now = new Date();
  const candidates: { startsAt: Date; endsAt: Date; priceKobo: number }[] = [];
  const intervalMinutes = slotDurationMinutes + bufferMinutes;

  for (let d = 0; d < daysAhead; d++) {
    const day = lagosCalendarDay(now, d);
    for (const rule of weeklyRules) {
      if (!rule.daysOfWeek.includes(day.dayOfWeek)) continue;

      for (
        let minute = rule.openMinutes;
        minute + slotDurationMinutes <= rule.closeMinutes;
        minute += intervalMinutes
      ) {
        const start = dateFromLagos(day.year, day.month, day.day, minute);
        if (start <= now) continue;

        const end = new Date(start.getTime() + slotDurationMinutes * 60_000);
        const peak =
          rule.peakPriceKobo !== null &&
          rule.peakPriceKobo !== undefined &&
          rule.peakStartMinutes !== null &&
          rule.peakStartMinutes !== undefined &&
          rule.peakEndMinutes !== null &&
          rule.peakEndMinutes !== undefined &&
          minute >= rule.peakStartMinutes &&
          minute < rule.peakEndMinutes;
        const priceKobo = peak && rule.peakPriceKobo ? rule.peakPriceKobo : rule.basePriceKobo;
        candidates.push({ startsAt: start, endsAt: end, priceKobo });
      }
    }
  }
  if (candidates.length === 0) return { ok: true, created: 0, skipped: 0, candidates: 0 };

  const existing = await getSlotsForPitch(pitchId, daysAhead + 1);
  const accepted: typeof candidates = [];
  for (const candidate of candidates.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const start = candidate.startsAt.getTime() - bufferMinutes * 60_000;
    const end = candidate.endsAt.getTime() + bufferMinutes * 60_000;
    const conflictsExisting = existing.some((slot) => {
      const slotStart = new Date(slot.startsAt).getTime() - bufferMinutes * 60_000;
      const slotEnd = new Date(slot.endsAt).getTime() + bufferMinutes * 60_000;
      return start < slotEnd && end > slotStart;
    });
    const conflictsAccepted = accepted.some((slot) => {
      const slotStart = slot.startsAt.getTime() - bufferMinutes * 60_000;
      const slotEnd = slot.endsAt.getTime() + bufferMinutes * 60_000;
      return start < slotEnd && end > slotStart;
    });
    if (!conflictsExisting && !conflictsAccepted) accepted.push(candidate);
  }
  const skipped = candidates.length - accepted.length;
  if (accepted.length === 0) return { ok: true, created: 0, skipped, candidates: candidates.length };

  if (demoMode()) {
    const s = store();
    for (const row of accepted) {
      s.slots.push({
        id: `sl-${pitchId}-${row.startsAt.getTime()}`,
        pitchId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        priceKobo: row.priceKobo,
        status: "open",
      });
    }
    return { ok: true, created: accepted.length, skipped, candidates: candidates.length };
  }

  const sb = await createClient();
  const { error } = await sb.from("slots").insert(
    accepted.map((row) => ({
      pitch_id: pitchId,
      during: `[${row.startsAt.toISOString()},${row.endsAt.toISOString()})`,
      price_kobo: row.priceKobo,
      status: "open",
    })),
  );
  if (error) return { ok: false, created: 0, skipped, candidates: candidates.length, error: error.message };
  return { ok: true, created: accepted.length, skipped, candidates: candidates.length };
}

function lagosCalendarDay(base: Date, addDays: number): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
} {
  const lagosTime = new Date(base.getTime() + 60 * 60_000 + addDays * 86_400_000);
  return {
    year: lagosTime.getUTCFullYear(),
    month: lagosTime.getUTCMonth(),
    day: lagosTime.getUTCDate(),
    dayOfWeek: lagosTime.getUTCDay(),
  };
}

function dateFromLagos(year: number, month: number, day: number, minutes: number): Date {
  return new Date(Date.UTC(year, month, day, Math.floor(minutes / 60) - 1, minutes % 60, 0, 0));
}

/** The "block this hour for maintenance" primitive. */
export async function setSlotStatus(
  slotId: string,
  status: "open" | "blocked",
): Promise<{ ok: boolean; error?: string }> {
  if (demoMode()) {
    const slot = store().slots.find((s) => s.id === slotId);
    if (!slot) return { ok: false, error: "Slot not found." };
    if (slot.status === "booked") {
      return { ok: false, error: "This slot is booked — cancel the booking instead." };
    }
    slot.status = status;
    return { ok: true };
  }

  // set_slot_status() locks the row and checks ownership + current status
  // server-side — a plain .update() had no guard against mutating an
  // already-booked slot (only a disabled button client-side), which could
  // silently orphan a paid, confirmed booking.
  const sb = await createClient();
  const { error } = await sb.rpc("set_slot_status", { p_slot_id: slotId, p_status: status });
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

const GAME_SELECT = `*, pitch:pitches(${PITCH_SELECT}), host:profiles(*), game_participants(*, player:profiles!game_participants_user_id_fkey(*))`;

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
    // A payment hold occupies a real spot, same as a fully-paid one.
    filled:
      (c.preconfirmedPlayerCount ?? 0) +
      participants.filter((p) => p.status === "confirmed" || p.status === "pending_payment").length,
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
    filled:
      (g.preconfirmedPlayerCount ?? 0) +
      participants.filter((p) => p.status === "confirmed" || p.status === "pending_payment").length,
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
      if (g.status === "cancelled") return false;
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

export async function getGameCheckInCode(gameId: string, userId: string): Promise<string | null> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb
      .from("game_participant_check_in_codes")
      .select("code")
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.code as string | undefined) ?? null;
  }

  const participant = store().participants.find((p) => p.gameId === gameId && p.userId === userId);
  return participant?.checkInCode ?? null;
}

/* --------------------------------------------------------------- mutations */

export type JoinResult =
  | {
      ok: true;
      status: "confirmed" | "waitlist" | "pending_payment";
      paidKobo: number;
      paymentDeadline: string | null;
    }
  | { ok: false; error: string };

/** now + 48h, capped so a hold can never outlive kickoff with no time left
 * to reallocate the spot. Shared by every place that opens a payment hold
 * (join_game, promote_next_waitlisted on the SQL side; mirrored here for
 * demo mode). */
function computePaymentDeadline(kickoffISO: string): string {
  const cap = new Date(new Date(kickoffISO).getTime() - 2 * 60 * 60 * 1000);
  const window = new Date(Date.now() + 48 * 60 * 60 * 1000);
  return (window < cap ? window : cap).toISOString();
}

function demoCheckInCode(prefix: "BKG" | "GME" | "TRF"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function demoChargeForJoin(
  userId: string,
  priceKobo: number,
  gameId: string,
): { paidKobo: number; status: "confirmed" | "pending_payment" } {
  const s = store();
  if (priceKobo <= 0) return { paidKobo: 0, status: "confirmed" };

  const balance = s.wallets[userId] ?? 0;
  const charge = Math.min(balance, priceKobo);
  if (charge > 0) {
    s.wallets[userId] = balance - charge;
    s.walletTransactions.push({
      id: `wt-${Date.now()}`,
      userId,
      type: "game_payment",
      status: "completed",
      amountKobo: -charge,
      balanceAfterKobo: s.wallets[userId],
      reference: `GPY-${Date.now().toString(36).toUpperCase()}`,
      provider: "wallet",
      providerRef: null,
      bookingId: null,
      gameId,
      createdAt: new Date().toISOString(),
    });
  }
  return { paidKobo: charge, status: charge >= priceKobo ? "confirmed" : "pending_payment" };
}

function demoRefreshGameMinimumStatus(gameId: string) {
  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game || (game.status !== "open" && game.status !== "locked")) return;
  const count = (game.preconfirmedPlayerCount ?? 0) + s.participants.filter(
    (p) => p.gameId === gameId && (p.status === "confirmed" || p.status === "pending_payment"),
  ).length;
  if (count >= game.minimumToGuarantee && game.minimumDecisionStatus === "pending") {
    game.minimumDecisionStatus = "not_needed";
  } else if (count < game.minimumToGuarantee && game.minimumDecisionStatus === "not_needed") {
    game.minimumDecisionStatus = "pending";
  }
}

function demoRefundGameParticipant(userId: string, refundKobo: number, type: "game_refund") {
  if (refundKobo <= 0) return;
  const s = store();
  const balance = (s.wallets[userId] ?? 0) + refundKobo;
  s.wallets[userId] = balance;
  s.walletTransactions.push({
    id: `wt-${Date.now()}`,
    userId,
    type,
    status: "completed",
    amountKobo: refundKobo,
    balanceAfterKobo: balance,
    reference: `GRF-${Date.now().toString(36).toUpperCase()}`,
    provider: null,
    providerRef: null,
    bookingId: null,
    gameId: null,
    createdAt: new Date().toISOString(),
  });
}

/** Promotes the next waitlisted player (if any) and tries to charge them —
 * demo-mode counterpart to the SQL promote_next_waitlisted() helper. */
function demoPromoteNextWaitlisted(gameId: string) {
  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return;

  const occupied = (game.preconfirmedPlayerCount ?? 0) + s.participants.filter(
    (p) => p.gameId === gameId && (p.status === "confirmed" || p.status === "pending_payment"),
  ).length;
  if (occupied >= game.capacity) {
    game.status = "locked";
    demoRefreshGameMinimumStatus(gameId);
    return;
  }

  const next = s.participants
    .filter((p) => p.gameId === gameId && p.status === "waitlist")
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];

  if (!next) {
    if (game.status === "locked") game.status = "open";
    return;
  }

  const { paidKobo, status } = demoChargeForJoin(next.userId, game.pricePerPlayerKobo, gameId);
  next.status = status;
  next.paidKobo = paidKobo;
  next.paymentDeadline = status === "pending_payment" ? computePaymentDeadline(game.startsAt) : null;
  if (occupied + 1 >= game.capacity) game.status = "locked";
  demoRefreshGameMinimumStatus(gameId);
}

/**
 * Join a game. In Supabase mode this calls the `join_game` RPC, which locks
 * the game row so two people cannot take the last spot simultaneously and
 * charges the player's wallet — the full price if it covers it, otherwise
 * whatever's available, landing them in `pending_payment` with a deadline
 * to top up the rest.
 */
export async function joinGame(gameId: string, userId: string): Promise<JoinResult> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("join_game", { p_game_id: gameId });
    if (error) return { ok: false, error: error.message };
    const row = camelize<GameParticipant>(data);
    return {
      ok: true,
      status: row.status as "confirmed" | "waitlist" | "pending_payment",
      paidKobo: row.paidKobo,
      paymentDeadline: row.paymentDeadline ?? null,
    };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  if (new Date(game.startsAt).getTime() <= Date.now())
    return { ok: false, error: "That game has already kicked off." };

  const existing = s.participants.find((p) => p.gameId === gameId && p.userId === userId);
  if (existing && existing.status !== "withdrawn")
    return { ok: false, error: "You're already in this game." };

  const held = (game.preconfirmedPlayerCount ?? 0) + s.participants.filter(
    (p) => p.gameId === gameId && (p.status === "confirmed" || p.status === "pending_payment"),
  ).length;
  const wouldHoldSpot = held < game.capacity;

  let status: GameParticipant["status"] = wouldHoldSpot ? "confirmed" : "waitlist";
  let paidKobo = 0;
  let paymentDeadline: string | null = null;

  if (wouldHoldSpot) {
    const charge = demoChargeForJoin(userId, game.pricePerPlayerKobo, gameId);
    status = charge.status;
    paidKobo = charge.paidKobo;
    paymentDeadline = status === "pending_payment" ? computePaymentDeadline(game.startsAt) : null;
  }

  if (existing) {
    existing.status = status;
    existing.joinedAt = new Date().toISOString();
    existing.paidKobo = paidKobo;
    existing.paymentDeadline = paymentDeadline;
    existing.checkInCode = demoCheckInCode("GME");
  } else {
    s.participants.push({
      id: `gp-${gameId}-${userId}-${Date.now()}`,
      gameId,
      userId,
      joinedAt: new Date().toISOString(),
      paidKobo,
      paymentDeadline,
      status,
      checkInCode: demoCheckInCode("GME"),
    });
  }

  if (wouldHoldSpot && held + 1 >= game.capacity) game.status = "locked";
  if (wouldHoldSpot) demoRefreshGameMinimumStatus(gameId);
  return { ok: true, status, paidKobo, paymentDeadline };
}

/** Completes an outstanding partial payment. Live mode calls
 * pay_game_balance(); demo mode mirrors the same "charge whatever's
 * available toward what's left, flip to confirmed once covered" logic. */
export async function payGameBalance(
  gameId: string,
  userId: string,
): Promise<{ ok: true; status: "confirmed" | "pending_payment" } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("pay_game_balance", { p_game_id: gameId });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("insufficient wallet balance")
          ? "Not enough wallet balance to cover this."
          : error.message,
      };
    }
    const row = camelize<GameParticipant>(data);
    return { ok: true, status: row.status as "confirmed" | "pending_payment" };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  const mine = s.participants.find((p) => p.gameId === gameId && p.userId === userId);
  if (!mine || mine.status !== "pending_payment") {
    return { ok: false, error: "No payment is due." };
  }

  const remaining = game.pricePerPlayerKobo - mine.paidKobo;
  const balance = s.wallets[userId] ?? 0;
  const charge = Math.min(balance, remaining);
  if (charge <= 0) return { ok: false, error: "Not enough wallet balance to cover this." };

  s.wallets[userId] = balance - charge;
  s.walletTransactions.push({
    id: `wt-${Date.now()}`,
    userId,
    type: "game_payment",
    status: "completed",
    amountKobo: -charge,
    balanceAfterKobo: s.wallets[userId],
    reference: `GPY-${Date.now().toString(36).toUpperCase()}`,
    provider: "wallet",
    providerRef: null,
    bookingId: null,
    gameId: null,
    createdAt: new Date().toISOString(),
  });

  mine.paidKobo += charge;
  if (mine.paidKobo >= game.pricePerPlayerKobo) {
    mine.status = "confirmed";
    mine.paymentDeadline = null;
  }
  demoRefreshGameMinimumStatus(gameId);
  return { ok: true, status: mine.status as "confirmed" | "pending_payment" };
}

/** 6-hour cutoff, same policy cancel_booking() uses for direct bookings:
 * 6h+ before kickoff refunds whatever the player had paid in; under 6h
 * forfeits it. Either way their spot opens up for the next person waiting. */
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
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  if (game.hostId === userId) return { ok: false, error: "Hosts must cancel the game instead." };
  const mine = s.participants.find((p) => p.gameId === gameId && p.userId === userId);
  if (!mine) return { ok: false, error: "Not a participant in this game." };

  mine.status = "withdrawn";

  const sixHoursMs = 6 * 60 * 60 * 1000;
  if (mine.paidKobo > 0 && new Date(game.startsAt).getTime() - Date.now() >= sixHoursMs) {
    demoRefundGameParticipant(userId, mine.paidKobo, "game_refund");
  }

  demoPromoteNextWaitlisted(gameId);
  demoRefreshGameMinimumStatus(gameId);
  return { ok: true };
}

/** Host (or admin) calls off the whole game — refunds every paid/held
 * participant in full regardless of the 6-hour cutoff (this isn't a player
 * backing out, it's the game itself being cancelled) and reopens the slot. */
export async function cancelGame(
  gameId: string,
  userId: string,
  isAdmin: boolean,
): Promise<{ ok: true; refundedKobo: number; refundedCount: number } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb
      .rpc("cancel_game_with_summary", { p_game_id: gameId })
      .single<{
        player_refunded_kobo: number | string | null;
        player_refunded_count: number | string | null;
        host_refunded_kobo: number | string | null;
      }>();
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      refundedKobo:
        Math.max(0, Number(data?.player_refunded_kobo ?? 0)) +
        Math.max(0, Number(data?.host_refunded_kobo ?? 0)),
      refundedCount: Math.max(0, Number(data?.player_refunded_count ?? 0)),
    };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  if (game.hostId !== userId && !isAdmin) return { ok: false, error: "Not authorized." };
  if (game.status !== "open" && game.status !== "locked") {
    return { ok: false, error: "Game cannot be cancelled." };
  }
  if (new Date(game.startsAt).getTime() <= Date.now()) {
    return { ok: false, error: "Game has already started." };
  }

  const occupied = (game.preconfirmedPlayerCount ?? 0) + s.participants.filter(
    (p) => p.gameId === gameId && (p.status === "confirmed" || p.status === "pending_payment"),
  ).length;
  if (!isAdmin && occupied * 100 >= game.capacity * 80) {
    return { ok: false, error: "Sessions at 80% full or above must proceed." };
  }

  game.status = "cancelled";
  game.minimumDecisionStatus = "cancelled";
  const slot = s.slots.find(
    (x) => x.pitchId === game.pitchId && x.startsAt === game.startsAt && x.status === "booked",
  );
  if (slot && !game.isExistingSession) slot.status = "open";

  const toRefund = s.participants.filter(
    (p) => p.gameId === gameId && (p.status === "confirmed" || p.status === "pending_payment") && p.paidKobo > 0,
  );
  let refundedKobo = 0;
  for (const p of toRefund) {
    demoRefundGameParticipant(p.userId, p.paidKobo, "game_refund");
    refundedKobo += p.paidKobo;
  }
  for (const p of s.participants.filter(
    (p) => p.gameId === gameId && ["confirmed", "pending_payment", "waitlist"].includes(p.status),
  )) {
    p.status = "withdrawn";
    p.paymentDeadline = null;
  }

  const hostRefund = game.isExistingSession ? 0 : Math.max(0, (game.hostPaidKobo ?? 0) - (game.hostReimbursedKobo ?? 0));
  const sixHoursMs = 6 * 60 * 60 * 1000;
  if (hostRefund > 0 && new Date(game.startsAt).getTime() - Date.now() >= sixHoursMs) {
    demoRefundGameParticipant(game.hostId, hostRefund, "game_refund");
    refundedKobo += hostRefund;
  }

  return { ok: true, refundedKobo, refundedCount: toRefund.length };
}

export async function decideGameMinimum(
  gameId: string,
  userId: string,
  isAdmin: boolean,
  decision: "go_ahead" | "cancel",
): Promise<{ ok: true; status: Game["status"]; decisionStatus: NonNullable<Game["minimumDecisionStatus"]> } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("decide_game_minimum", {
      p_game_id: gameId,
      p_decision: decision,
    });
    if (error) return { ok: false, error: error.message };
    const game = camelize<Game>(data);
    return {
      ok: true,
      status: game.status,
      decisionStatus: game.minimumDecisionStatus ?? "pending",
    };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  if (game.hostId !== userId && !isAdmin) return { ok: false, error: "Not authorized." };
  if (game.status !== "open" && game.status !== "locked") {
    return { ok: false, error: "Game cannot be decided." };
  }
  if (new Date(game.startsAt).getTime() <= Date.now()) {
    return { ok: false, error: "Game has already started." };
  }

  const count = (game.preconfirmedPlayerCount ?? 0) + s.participants.filter(
    (p) => p.gameId === gameId && (p.status === "confirmed" || p.status === "pending_payment"),
  ).length;
  if (count >= game.minimumToGuarantee) {
    game.minimumDecisionStatus = "not_needed";
    return { ok: true, status: game.status, decisionStatus: "not_needed" };
  }
  const deadlineAt = game.minimumDecisionDeadline ? new Date(game.minimumDecisionDeadline).getTime() : new Date(game.startsAt).getTime();
  if (!isAdmin && deadlineAt > Date.now()) {
    return { ok: false, error: "Minimum decision is not due yet." };
  }

  if (decision === "cancel") {
    const cancelled = await cancelGame(gameId, userId, isAdmin);
    if (!cancelled.ok) return cancelled;
    return { ok: true, status: "cancelled", decisionStatus: "cancelled" };
  }

  game.minimumDecisionStatus = "go_ahead";
  return { ok: true, status: game.status, decisionStatus: "go_ahead" };
}

export async function settleGameHostReimbursement(
  gameId: string,
  userId: string,
  isAdmin: boolean,
): Promise<{ ok: true; reimbursedKobo: number } | { ok: false; error: string }> {
  if (!demoMode()) {
    const before = await getGameById(gameId);
    const sb = await createClient();
    const { data, error } = await sb.rpc("settle_game_host_reimbursement", {
      p_game_id: gameId,
    });
    if (error) return { ok: false, error: error.message };
    const after = camelize<Game>(data);
    return {
      ok: true,
      reimbursedKobo:
        (after.hostReimbursedKobo ?? 0) - (before?.hostReimbursedKobo ?? 0) +
        (after.hostEarningsKobo ?? 0) - (before?.hostEarningsKobo ?? 0),
    };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  if (game.hostId !== userId && !isAdmin) return { ok: false, error: "Not authorized." };
  if (new Date(game.endsAt).getTime() > Date.now()) {
    return { ok: false, error: "Game has not ended yet." };
  }
  if (game.minimumDecisionStatus !== "go_ahead" && game.minimumDecisionStatus !== "not_needed") {
    return { ok: false, error: "Host has not committed this game." };
  }

  const collected = s.participants
    .filter((p) => p.gameId === gameId && ["confirmed", "played", "no_show"].includes(p.status))
    .reduce((sum, p) => sum + p.paidKobo, 0);
  const pitchCost = game.hostPitchCostKobo ?? Math.max(0, (game.hostPaidKobo ?? 0) - Math.round((game.hostPaidKobo ?? 0) * 0.05));
  const already = game.hostReimbursedKobo ?? 0;
  const earningsAlready = game.hostEarningsKobo ?? 0;
  const due = Math.max(0, Math.min(collected, pitchCost) - already);
  const earnings = Math.max(0, collected - pitchCost - earningsAlready);
  if (due <= 0 && earnings <= 0) return { ok: true, reimbursedKobo: 0 };

  let balance = (s.wallets[game.hostId] ?? 0);
  game.hostReimbursedKobo = already + due;
  game.hostEarningsKobo = earningsAlready + earnings;
  if (due > 0) {
    balance += due;
    s.walletTransactions.push({
      id: `wt-${Date.now()}`,
      userId: game.hostId,
      type: "host_reimbursement",
      status: "completed",
      amountKobo: due,
      balanceAfterKobo: balance,
      reference: `HRB-${Date.now().toString(36).toUpperCase()}`,
      provider: null,
      providerRef: null,
      bookingId: null,
      gameId,
      createdAt: new Date().toISOString(),
    });
  }
  if (earnings > 0) {
    balance += earnings;
    s.walletTransactions.push({
      id: `wt-${Date.now()}-earnings`,
      userId: game.hostId,
      type: "host_game_earnings",
      status: "completed",
      amountKobo: earnings,
      balanceAfterKobo: balance,
      reference: `HPE-${Date.now().toString(36).toUpperCase()}`,
      provider: null,
      providerRef: null,
      bookingId: null,
      gameId,
      createdAt: new Date().toISOString(),
    });
  }
  s.wallets[game.hostId] = balance;

  return { ok: true, reimbursedKobo: due + earnings };
}

export type AttendanceEvent = "checked_in" | "late" | "no_show" | "flagged";

export async function markGameAttendance(
  participantId: string,
  actorId: string,
  event: AttendanceEvent,
  minutesLate: number | null = null,
  note = "",
  checkInCode = "",
): Promise<{ ok: true; participant: GameParticipant } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("mark_game_attendance", {
      p_participant_id: participantId,
      p_event: event,
      p_minutes_late: minutesLate,
      p_note: note || null,
      p_check_in_code: checkInCode || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, participant: camelize<GameParticipant>(data) };
  }

  const s = store();
  const p = s.participants.find((x) => x.id === participantId);
  if (!p) return { ok: false, error: "Participant not found." };
  const game = s.games.find((g) => g.id === p.gameId);
  if (!game) return { ok: false, error: "Game not found." };
  const pitch = s.pitches.find((x) => x.id === game.pitchId);
  const venue = pitch ? s.venues.find((x) => x.id === pitch.venueId) : null;
  if (game.hostId !== actorId && venue?.ownerId !== actorId && !s.profiles.find((x) => x.id === actorId && x.role === "admin")) {
    return { ok: false, error: "Not authorized." };
  }
  if (checkInCode && p.checkInCode && checkInCode.toUpperCase() !== p.checkInCode.toUpperCase()) {
    return { ok: false, error: "Invalid check-in code." };
  }

  p.attendanceStatus = event;
  p.attendanceNote = note || null;
  if (event === "checked_in" || event === "late") {
    p.checkedInAt = p.checkedInAt ?? new Date().toISOString();
    p.checkedInBy = actorId;
    if (event === "late") p.minutesLate = Math.max(0, minutesLate ?? 0);
    if (new Date(game.endsAt).getTime() <= Date.now()) p.status = "played";
  } else if (event === "no_show") {
    p.status = "no_show";
  }
  return { ok: true, participant: p };
}

export async function markBookingAttendance(
  bookingId: string,
  actorId: string,
  event: AttendanceEvent,
  minutesLate: number | null = null,
  note = "",
  checkInCode = "",
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("mark_booking_attendance", {
      p_booking_id: bookingId,
      p_event: event,
      p_minutes_late: minutesLate,
      p_note: note || null,
      p_check_in_code: checkInCode || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, booking: camelize<Booking>(data) };
  }

  const s = store();
  const booking = s.bookings.find((b) => b.id === bookingId);
  if (!booking) return { ok: false, error: "Booking not found." };
  const slot = s.slots.find((x) => x.id === booking.slotId);
  const pitch = slot ? s.pitches.find((x) => x.id === slot.pitchId) : null;
  const venue = pitch ? s.venues.find((x) => x.id === pitch.venueId) : null;
  if (venue?.ownerId !== actorId && !s.profiles.find((x) => x.id === actorId && x.role === "admin")) {
    return { ok: false, error: "Not authorized." };
  }
  if (checkInCode && booking.checkInCode && checkInCode.toUpperCase() !== booking.checkInCode.toUpperCase()) {
    return { ok: false, error: "Invalid check-in code." };
  }
  booking.attendanceStatus = event;
  booking.attendanceNote = note || null;
  if (event === "checked_in" || event === "late") {
    booking.checkedInAt = booking.checkedInAt ?? new Date().toISOString();
    booking.checkedInBy = actorId;
    if (slot && new Date(slot.endsAt).getTime() <= Date.now()) booking.status = "completed";
  }
  return { ok: true, booking };
}

export async function createGameSlotTransferOffer(
  gameId: string,
  userId: string,
): Promise<{ ok: true; code: string; expiresAt: string } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("offer_game_slot_transfer", { p_game_id: gameId });
    if (error) return { ok: false, error: error.message };
    const row = camelize<{ code: string; expiresAt: string }>(data);
    return { ok: true, code: row.code, expiresAt: row.expiresAt };
  }

  const s = store();
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, error: "Game not found." };
  const mine = s.participants.find((p) => p.gameId === gameId && p.userId === userId && p.status === "confirmed");
  if (!mine || mine.paidKobo < game.pricePerPlayerKobo) {
    return { ok: false, error: "Only fully paid confirmed players can transfer a spot." };
  }
  if (game.hostId === userId) return { ok: false, error: "Hosts cannot transfer the host spot." };
  const code = demoCheckInCode("TRF");
  return { ok: true, code, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
}

export async function acceptGameSlotTransfer(
  code: string,
): Promise<{ ok: true; participant: GameParticipant } | { ok: false; error: string }> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data, error } = await sb.rpc("accept_game_slot_transfer", { p_code: code });
    if (error) return { ok: false, error: error.message };
    return { ok: true, participant: camelize<GameParticipant>(data) };
  }
  return { ok: false, error: "Slot transfer acceptance needs the live database." };
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
    checkInCode: demoCheckInCode("BKG"),
    attendanceStatus: "booked",
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
    gameId: null,
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
      gameId: null,
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

export interface HostPayoutOverview {
  bankAccount: HostBankAccount | null;
  requests: HostPayoutRequest[];
  withdrawableKobo: number;
}

/** Host earnings remain reusable wallet credit. This view identifies the
 * portion that came from completed host sessions and has not been reserved
 * for a bank payout, capped by the user's actual wallet balance. */
export async function getHostPayoutOverview(userId: string): Promise<HostPayoutOverview> {
  if (demoMode()) return { bankAccount: null, requests: [], withdrawableKobo: 0 };

  const sb = await createClient();
  const [{ data: account }, { data: requests }, { data: wallet }, { data: transactions }] = await Promise.all([
    sb.from("host_bank_accounts").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("host_payout_requests").select("*").eq("user_id", userId).order("requested_at", { ascending: false }),
    sb.from("wallets").select("balance_kobo").eq("user_id", userId).maybeSingle(),
    sb
      .from("wallet_transactions")
      .select("type, amount_kobo")
      .eq("user_id", userId)
      .eq("status", "completed")
      .in("type", ["host_reimbursement", "host_game_earnings", "host_withdrawal", "host_withdrawal_reversal"]),
  ]);

  const earned = (transactions ?? [])
    .filter((row) => row.type === "host_reimbursement" || row.type === "host_game_earnings")
    .reduce((sum, row) => sum + Number(row.amount_kobo), 0);
  const reserved = (transactions ?? []).reduce((sum, row) => {
    if (row.type === "host_withdrawal") return sum + Math.max(0, -Number(row.amount_kobo));
    if (row.type === "host_withdrawal_reversal") return sum - Math.max(0, Number(row.amount_kobo));
    return sum;
  }, 0);

  return {
    bankAccount: account ? camelize<HostBankAccount>(account) : null,
    requests: camelize<HostPayoutRequest[]>(requests ?? []),
    withdrawableKobo: Math.max(0, Math.min(Number(wallet?.balance_kobo ?? 0), earned - reserved)),
  };
}

export interface HostPayoutAdminRow extends HostPayoutRequest {
  fullName: string;
  handle: string;
}

export async function listHostPayoutRequestsAdmin(limit = 100): Promise<HostPayoutAdminRow[]> {
  if (demoMode()) return [];
  const sb = await createClient();
  const { data } = await sb
    .from("host_payout_requests")
    .select("*, profile:profiles!user_id(full_name, handle)")
    .order("scheduled_for", { ascending: true })
    .order("requested_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map((row) => {
    const value = camelize<HostPayoutRequest & { profile: { fullName: string; handle: string } | null }>(row);
    const { profile, ...request } = value;
    return { ...request, fullName: profile?.fullName ?? "Unknown", handle: profile?.handle ?? "unknown" };
  });
}

/* --------------------------------------------------------- admin finance --
 * Read-only visibility only, this pass — no manual wallet adjustment.
 * wallets/wallet_transactions RLS was deliberately self-only until
 * 0015_admin_finance_read.sql added an is_admin() bypass; live-mode only,
 * matching how verifyVenue() already rejects demo mode (there's nothing
 * cross-user to aggregate in the single-process demo store the same way).
 */

export interface WalletAdminRow {
  userId: string;
  handle: string;
  fullName: string;
  balanceKobo: number;
  updatedAt: string;
}

export async function listWalletsAdmin(): Promise<WalletAdminRow[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data } = await sb
    .from("wallets")
    .select("user_id, balance_kobo, updated_at, profile:profiles!user_id(handle, full_name)")
    .order("balance_kobo", { ascending: false });

  return (data ?? []).map((row) => {
    const c = camelize<{
      userId: string;
      balanceKobo: number;
      updatedAt: string;
      profile: { handle: string; fullName: string } | null;
    }>(row);
    return {
      userId: c.userId,
      handle: c.profile?.handle ?? "unknown",
      fullName: c.profile?.fullName ?? "Unknown",
      balanceKobo: c.balanceKobo,
      updatedAt: c.updatedAt,
    };
  });
}

export interface WalletTransactionAdminRow extends WalletTransaction {
  handle: string;
  fullName: string;
}

export async function listWalletTransactionsAdmin(limit = 100): Promise<WalletTransactionAdminRow[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data } = await sb
    .from("wallet_transactions")
    .select("*, profile:profiles!user_id(handle, full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const c = camelize<WalletTransaction & { profile: { handle: string; fullName: string } | null }>(row);
    const { profile, ...txn } = c;
    return { ...txn, handle: profile?.handle ?? "unknown", fullName: profile?.fullName ?? "Unknown" };
  });
}

export interface FinanceSummary {
  totalWalletLiabilityKobo: number;
  totalTopupVolumeKobo: number;
  totalBookingPaymentVolumeKobo: number;
  totalGamePaymentVolumeKobo: number;
  totalHostDepositVolumeKobo: number;
  totalCancellationCreditsKobo: number;
  totalGameRefundsKobo: number;
  totalHostReimbursementsKobo: number;
  tempoHeldGameFundsKobo: number;
  totalVenuePendingKobo: number;
  totalVenueAvailableKobo: number;
  totalVenuePaidOutKobo: number;
  totalPlatformFeeLedgerKobo: number;
  serviceFeeRevenueKobo: number;
}

/** Computed from wallet_transactions, not a new table — same "honest
 * numbers, never invented" approach getPlatformStats() already uses. */
export async function getFinanceSummary(): Promise<FinanceSummary> {
  if (demoMode()) {
    return {
      totalWalletLiabilityKobo: 0,
      totalTopupVolumeKobo: 0,
      totalBookingPaymentVolumeKobo: 0,
      totalGamePaymentVolumeKobo: 0,
      totalHostDepositVolumeKobo: 0,
      totalCancellationCreditsKobo: 0,
      totalGameRefundsKobo: 0,
      totalHostReimbursementsKobo: 0,
      tempoHeldGameFundsKobo: 0,
      totalVenuePendingKobo: 0,
      totalVenueAvailableKobo: 0,
      totalVenuePaidOutKobo: 0,
      totalPlatformFeeLedgerKobo: 0,
      serviceFeeRevenueKobo: 0,
    };
  }

  const sb = await createClient();
  const [{ data: wallets }, { data: txns }, { data: settlements }] = await Promise.all([
    sb.from("wallets").select("balance_kobo"),
    sb.from("wallet_transactions").select("type, amount_kobo, status").eq("status", "completed"),
    sb.from("venue_settlements").select("status, venue_amount_kobo, platform_fee_kobo, available_at"),
  ]);

  const totalWalletLiabilityKobo = (wallets ?? []).reduce((sum, w) => sum + (w.balance_kobo as number), 0);
  const totalTopupVolumeKobo = (txns ?? [])
    .filter((t) => t.type === "topup")
    .reduce((sum, t) => sum + (t.amount_kobo as number), 0);
  const totalBookingPaymentVolumeKobo = Math.abs(
    (txns ?? [])
      .filter((t) => t.type === "booking_payment")
      .reduce((sum, t) => sum + (t.amount_kobo as number), 0),
  );
  const totalGamePaymentVolumeKobo = Math.abs(
    (txns ?? [])
      .filter((t) => t.type === "game_payment")
      .reduce((sum, t) => sum + (t.amount_kobo as number), 0),
  );
  const totalHostDepositVolumeKobo = Math.abs(
    (txns ?? [])
      .filter((t) => t.type === "host_game_deposit")
      .reduce((sum, t) => sum + (t.amount_kobo as number), 0),
  );
  const totalCancellationCreditsKobo = (txns ?? [])
    .filter((t) => t.type === "cancellation_credit")
    .reduce((sum, t) => sum + (t.amount_kobo as number), 0);
  const totalGameRefundsKobo = (txns ?? [])
    .filter((t) => t.type === "game_refund")
    .reduce((sum, t) => sum + (t.amount_kobo as number), 0);
  const totalHostReimbursementsKobo = (txns ?? [])
    .filter((t) => t.type === "host_reimbursement")
    .reduce((sum, t) => sum + (t.amount_kobo as number), 0);
  const tempoHeldGameFundsKobo = Math.max(
    0,
    totalGamePaymentVolumeKobo + totalHostDepositVolumeKobo - totalGameRefundsKobo - totalHostReimbursementsKobo,
  );
  const settlementRows = settlements ?? [];
  const totalVenuePendingKobo = settlementRows
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + (s.venue_amount_kobo as number), 0);
  const totalVenueAvailableKobo = settlementRows
    .filter((s) => s.status === "pending" && new Date(s.available_at as string).getTime() <= Date.now())
    .reduce((sum, s) => sum + (s.venue_amount_kobo as number), 0);
  const totalVenuePaidOutKobo = settlementRows
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + (s.venue_amount_kobo as number), 0);
  const totalPlatformFeeLedgerKobo = settlementRows
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + (s.platform_fee_kobo as number), 0);

  return {
    totalWalletLiabilityKobo,
    totalTopupVolumeKobo,
    totalBookingPaymentVolumeKobo,
    totalGamePaymentVolumeKobo,
    totalHostDepositVolumeKobo,
    totalCancellationCreditsKobo,
    totalGameRefundsKobo,
    totalHostReimbursementsKobo,
    tempoHeldGameFundsKobo,
    totalVenuePendingKobo,
    totalVenueAvailableKobo,
    totalVenuePaidOutKobo,
    totalPlatformFeeLedgerKobo,
    serviceFeeRevenueKobo: Math.round(
      (totalBookingPaymentVolumeKobo * SERVICE_FEE_RATE) / (1 + SERVICE_FEE_RATE),
    ),
  };
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

/**
 * Real booking records for every pitch under a venue — reference, player,
 * amount, status — not the slot-status-derived approximation `/venue` used
 * to show. `bookings_read_venue` RLS (0001_init.sql) already lets an owner
 * select these; this was simply never called from anywhere.
 */
export async function getBookingsForVenue(venueId: string) {
  if (!demoMode()) {
    const sb = await createClient();
    const { data: pitchRows } = await sb.from("pitches").select("id").eq("venue_id", venueId);
    const pitchIds = (pitchRows ?? []).map((p) => p.id as string);
    if (pitchIds.length === 0) return [];

    const { data } = await sb
      .from("bookings")
      .select(`*, slot:slots!inner(*, pitch:pitches(${PITCH_SELECT})), player:profiles!user_id(handle, full_name, avatar_url)`)
      .in("slot.pitch_id", pitchIds)
      .order("created_at", { ascending: false });

    return (data ?? []).map((row) => {
      const c = camelize<
        Booking & { slot: Slot & { pitch: PitchWithVenue }; player?: { handle: string; fullName: string; avatarUrl: string | null } }
      >(row);
      return c;
    });
  }

  const s = store();
  const pitchIds = new Set(s.pitches.filter((p) => p.venueId === venueId).map((p) => p.id));
  const bookings = s.bookings.filter((b) => {
    const slot = s.slots.find((x) => x.id === b.slotId);
    return slot && pitchIds.has(slot.pitchId);
  });

  return Promise.all(
    bookings
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(async (b) => {
        const slot = await getSlot(b.slotId);
        const player = s.profiles.find((p) => p.id === b.userId);
        return { ...b, slot: slot!, player: player ? { handle: player.handle, fullName: player.fullName, avatarUrl: player.avatarUrl } : undefined };
      }),
  );
}

/** Games hosted on any pitch under a venue — for the owner calendar,
 * alongside getBookingsForVenue(). Same pitch-ids-first approach. */
export async function getGamesForVenue(venueId: string): Promise<GameFull[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data: pitchRows } = await sb.from("pitches").select("id").eq("venue_id", venueId);
    const pitchIds = (pitchRows ?? []).map((p) => p.id as string);
    if (pitchIds.length === 0) return [];

    const { data } = await sb
      .from("games")
      .select(GAME_SELECT)
      .in("pitch_id", pitchIds)
      .order("starts_at", { ascending: true });

    return (data ?? []).map(mapGameRow);
  }

  const s = store();
  const pitchIds = new Set(s.pitches.filter((p) => p.venueId === venueId).map((p) => p.id));
  return s.games
    .filter((g) => pitchIds.has(g.pitchId))
    .map(hydrateGame)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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

export interface SubmitVenueOwnerApplicationInput {
  venueName: string;
  area: string;
  address: string;
  phone?: string | null;
  notes?: string | null;
}

export async function submitVenueOwnerApplication(
  userId: string,
  input: SubmitVenueOwnerApplicationInput,
): Promise<{ ok: true; application: VenueOwnerApplication } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Applications need a live database." };

  const sb = await createClient();
  const { data, error } = await sb
    .from("venue_owner_applications")
    .insert({
      user_id: userId,
      venue_name: input.venueName,
      area: input.area,
      address: input.address,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, application: camelize<VenueOwnerApplication>(data) };
}

export async function getVenueOwnerApplication(userId: string): Promise<VenueOwnerApplication | null> {
  if (demoMode()) return null;

  const sb = await createClient();
  const { data } = await sb
    .from("venue_owner_applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? camelize<VenueOwnerApplication>(data) : null;
}

export async function listVenueOwnerApplicationsAdmin(): Promise<VenueOwnerApplication[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data } = await sb
    .from("venue_owner_applications")
    .select("*, applicant:profiles!user_id(id, handle, full_name, avatar_url, area, role, identity_verified)")
    .order("created_at", { ascending: false });

  return camelize<VenueOwnerApplication[]>(data ?? []);
}

export async function reviewVenueOwnerApplication(
  applicationId: string,
  approve: boolean,
  note: string,
): Promise<{ ok: true; application: VenueOwnerApplication } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Applications need a live database." };

  const sb = await createClient();
  const { data, error } = await sb.rpc("admin_review_venue_owner_application", {
    p_application_id: applicationId,
    p_approve: approve,
    p_note: note,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, application: camelize<VenueOwnerApplication>(data) };
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

const VENUE_SELECT = "*, verifier:profiles!verified_by(full_name)";

function mapVenueRow(row: Record<string, unknown>): Venue {
  const c = camelize<Venue & { verifier?: { fullName?: string } | null }>(row);
  const { verifier, ...venue } = c;
  return { ...venue, verifiedByName: verifier?.fullName ?? null };
}

export async function listVenues(): Promise<Venue[]> {
  if (!demoMode()) {
    const sb = await createClient();
    const { data } = await sb.from("venues").select(VENUE_SELECT);
    return (data ?? []).map(mapVenueRow);
  }
  const s = store();
  return s.venues.map((v) => ({
    ...v,
    verifiedByName: v.verifiedBy ? (s.profiles.find((p) => p.id === v.verifiedBy)?.fullName ?? null) : null,
  }));
}

export interface CreateVenueInput {
  name: string;
  area: string;
  side: "island" | "mainland";
  address: string;
  lat: number;
  lng: number;
  activityType?: string;
  supportedActivities?: string[];
  phone?: string;
  amenities?: string[];
  photos?: string[];
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
      activityType: input.activityType ?? "football",
      supportedActivities: input.supportedActivities ?? [input.activityType ?? "football"],
      verified: false,
      verifiedAt: null,
      phone: input.phone ?? null,
      amenities: input.amenities ?? [],
      photos: input.photos ?? [],
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
      activity_type: input.activityType || "football",
      supported_activities: input.supportedActivities ?? [input.activityType || "football"],
      phone: input.phone || null,
      amenities: input.amenities ?? [],
      photos: input.photos ?? [],
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
  activityType?: string;
  supportedActivities?: string[];
  phone?: string | null;
  amenities?: string[];
  photos?: string[];
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
  if (input.activityType !== undefined) patch.activity_type = input.activityType;
  if (input.supportedActivities !== undefined) patch.supported_activities = input.supportedActivities;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.amenities !== undefined) patch.amenities = input.amenities;
  if (input.photos !== undefined) patch.photos = input.photos;
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

  // Sequential, not atomic with the update above — this is an audit-log
  // insert, not a money operation, matching how every other non-money admin
  // action in this codebase is a plain call rather than an RPC. A failure
  // here would only lose one history entry, never corrupt the venue state.
  await sb.from("venue_verification_events").insert({
    venue_id: venueId,
    admin_id: adminId,
    verified,
    note: note || null,
  });

  return { ok: true };
}

/** Full verify/unverify history for one venue, newest first — unlike
 * venues.verified_at/verified_by/verification_note, which only ever hold
 * the current state, this is never overwritten. */
export async function getVenueVerificationHistory(venueId: string): Promise<VenueVerificationEvent[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data } = await sb
    .from("venue_verification_events")
    .select("*, admin:profiles!admin_id(full_name)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const c = camelize<VenueVerificationEvent & { admin?: { fullName?: string } | null }>(row);
    const { admin, ...event } = c;
    return { ...event, adminName: admin?.fullName ?? "Unknown admin" };
  });
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

/* -------------------------------------------------- identity verification --
 * Document upload + admin manual review. No phone/SMS OTP — no provider is
 * wired up. Live-mode only: this is the first upload surface in the app,
 * and there's nothing meaningful to fake in the single-process demo store.
 */

const IDENTITY_BUCKET = "identity-documents";
const VENUE_PHOTOS_BUCKET = "venue-photos";

/** Uploads to a {userId}/... path — the storage RLS policies require the
 * first path segment to match auth.uid(). */
export async function uploadIdentityDocument(
  userId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };

  const sb = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await sb.storage.from(IDENTITY_BUCKET).upload(path, file, { upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function uploadVenuePhoto(
  userId: string,
  venueId: string,
  file: File,
): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Photo upload needs the live database." };

  const sb = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const path = `${userId}/${venueId}/${Date.now()}.${ext}`;

  const { error } = await sb.storage.from(VENUE_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = sb.storage.from(VENUE_PHOTOS_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}

const PROFILE_PHOTOS_BUCKET = "profile-photos";

export async function uploadProfilePhoto(
  userId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Photo upload needs the live database." };

  const sb = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await sb.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  const { data } = sb.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

/** avatar_url is in the self-editable column grant (0002) — a plain
 * session-scoped UPDATE, RLS already restricts it to the caller's own row. */
export async function updateAvatarUrl(
  userId: string,
  avatarUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) {
    const s = store();
    const profile = s.profiles.find((p) => p.id === userId);
    if (profile) profile.avatarUrl = avatarUrl;
    return { ok: true };
  }

  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateEmailNotificationPreference(
  userId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) {
    const s = store();
    const profile = s.profiles.find((p) => p.id === userId);
    if (profile) profile.emailNotificationsEnabled = enabled;
    return { ok: true };
  }

  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ email_notifications_enabled: enabled }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* -------------------------------------------------------- match chat ---- */

const CHAT_PLAYER_SELECT = "id, full_name, handle, avatar_url";

async function isGameChatMember(sb: Awaited<ReturnType<typeof createClient>>, gameId: string, userId: string): Promise<boolean> {
  const { data: game } = await sb.from("games").select("host_id").eq("id", gameId).maybeSingle();
  if (game?.host_id === userId) return true;
  const { data: participant } = await sb
    .from("game_participants")
    .select("status")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!participant && ["confirmed", "pending_payment", "played", "no_show"].includes(participant.status);
}

export async function getGameChatMessages(gameId: string): Promise<GameChatMessage[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data, error } = await sb
    .from("game_chat_messages")
    .select(`*, player:profiles!user_id(${CHAT_PLAYER_SELECT})`)
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return camelize<GameChatMessage[]>(data).reverse();
}

export async function sendGameChatMessage(
  gameId: string,
  userId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Match chat needs the live database." };

  const sb = await createClient();
  if (!(await isGameChatMember(sb, gameId, userId))) {
    return { ok: false, error: "You can only chat in a match you're part of." };
  }

  const { error } = await sb.from("game_chat_messages").insert({ game_id: gameId, user_id: userId, body });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* -------------------------------------------------- direct messaging ---- */

const DM_THREAD_SELECT = `*, userAProfile:profiles!user_a(${CHAT_PLAYER_SELECT}), userBProfile:profiles!user_b(${CHAT_PLAYER_SELECT})`;

interface RawDmThreadRow {
  id: string;
  userA: string;
  userB: string;
  createdAt: string;
  lastMessageAt: string;
  userALastReadAt: string | null;
  userBLastReadAt: string | null;
  userAProfile: { id: string; fullName: string; handle: string; avatarUrl: string | null } | null;
  userBProfile: { id: string; fullName: string; handle: string; avatarUrl: string | null } | null;
}

function hydrateDmThread(row: RawDmThreadRow, viewerId: string): DmThread {
  const viewerIsA = row.userA === viewerId;
  const otherProfile = viewerIsA ? row.userBProfile : row.userAProfile;
  const myLastRead = viewerIsA ? row.userALastReadAt : row.userBLastReadAt;
  return {
    id: row.id,
    userA: row.userA,
    userB: row.userB,
    createdAt: row.createdAt,
    lastMessageAt: row.lastMessageAt,
    userALastReadAt: row.userALastReadAt,
    userBLastReadAt: row.userBLastReadAt,
    otherPlayer: {
      id: otherProfile?.id ?? "",
      fullName: otherProfile?.fullName ?? "Unknown player",
      handle: otherProfile?.handle ?? "",
      avatarUrl: otherProfile?.avatarUrl ?? null,
      initials: initialsOf(otherProfile?.fullName ?? "?"),
    },
    unread: !myLastRead || new Date(row.lastMessageAt).getTime() > new Date(myLastRead).getTime(),
  };
}

export async function listDmThreadsForUser(userId: string): Promise<DmThread[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data, error } = await sb
    .from("dm_threads")
    .select(DM_THREAD_SELECT)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("last_message_at", { ascending: false });
  if (error || !data) return [];
  return camelize<RawDmThreadRow[]>(data).map((row) => hydrateDmThread(row, userId));
}

export async function getOrCreateDmThread(
  otherUserId: string,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Direct messages need the live database." };

  const sb = await createClient();
  const { data, error } = await sb.rpc("get_or_create_dm_thread", { p_other_user_id: otherUserId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, threadId: (data as { id: string }).id };
}

export async function getDmThread(threadId: string, viewerId: string): Promise<DmThread | null> {
  if (demoMode()) return null;

  const sb = await createClient();
  const { data, error } = await sb.from("dm_threads").select(DM_THREAD_SELECT).eq("id", threadId).maybeSingle();
  if (error || !data) return null;
  return hydrateDmThread(camelize<RawDmThreadRow>(data), viewerId);
}

export async function getDmMessages(threadId: string): Promise<DmMessage[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  const { data, error } = await sb
    .from("dm_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error || !data) return [];
  return camelize<DmMessage[]>(data);
}

export async function sendDmMessage(
  threadId: string,
  senderId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Direct messages need the live database." };

  const sb = await createClient();
  const { error } = await sb.from("dm_messages").insert({ thread_id: threadId, sender_id: senderId, body });
  if (error) return { ok: false, error: "That message couldn't be sent — you may have been blocked." };
  return { ok: true };
}

export async function markDmThreadRead(threadId: string): Promise<void> {
  if (demoMode()) return;
  const sb = await createClient();
  await sb.rpc("mark_dm_thread_read", { p_thread_id: threadId });
}

export async function getUnreadDmThreadCount(userId: string): Promise<number> {
  if (demoMode() || !userId) return 0;
  const sb = await createClient();
  const { data, error } = await sb.rpc("get_unread_dm_thread_count");
  if (error || typeof data !== "number") return 0;
  return data;
}

/** Mirrors get_or_create_dm_thread()'s eligibility check, read-only — used
 * to decide whether to SHOW a "Message" button, without creating a thread
 * just because someone viewed a profile. */
export async function canMessagePlayer(viewerId: string, targetId: string): Promise<boolean> {
  if (demoMode() || viewerId === targetId) return false;

  const sb = await createClient();
  const { data: blocked } = await sb.rpc("is_blocked_between", { a: viewerId, b: targetId });
  if (blocked) return false;

  const [viewerParticipant, viewerHosted, targetParticipant, targetHosted] = await Promise.all([
    sb.from("game_participants").select("game_id").eq("user_id", viewerId).in("status", ["confirmed", "played"]),
    sb.from("games").select("id").eq("host_id", viewerId),
    sb.from("game_participants").select("game_id").eq("user_id", targetId).in("status", ["confirmed", "played"]),
    sb.from("games").select("id").eq("host_id", targetId),
  ]);

  const viewerGameIds = new Set([
    ...(viewerParticipant.data ?? []).map((r) => r.game_id),
    ...(viewerHosted.data ?? []).map((r) => r.id),
  ]);
  const targetGameIds = new Set([
    ...(targetParticipant.data ?? []).map((r) => r.game_id),
    ...(targetHosted.data ?? []).map((r) => r.id),
  ]);

  for (const id of viewerGameIds) {
    if (targetGameIds.has(id)) return true;
  }
  return false;
}

/* -------------------------------------------------------- moderation ---- */

export async function hasBlockedUser(blockerId: string, blockedId: string): Promise<boolean> {
  if (demoMode()) return false;
  const sb = await createClient();
  const { data } = await sb
    .from("blocked_users")
    .select("blocker_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  return !!data;
}

export async function blockUser(blockerId: string, blockedId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };
  const sb = await createClient();
  const { error } = await sb.from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };
  const sb = await createClient();
  const { error } = await sb.from("blocked_users").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reportMessage(input: {
  reporterId: string;
  reportedUserId: string;
  source: MessageReportSource;
  contextId: string;
  messageSnapshot: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };
  const sb = await createClient();
  const { error } = await sb.from("message_reports").insert({
    reporter_id: input.reporterId,
    reported_user_id: input.reportedUserId,
    source: input.source,
    context_id: input.contextId,
    message_snapshot: input.messageSnapshot,
    reason: input.reason,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMessageReports(): Promise<MessageReport[]> {
  if (demoMode()) return [];
  const sb = await createClient();
  const { data, error } = await sb
    .from("message_reports")
    .select("*, reporter:profiles!reporter_id(full_name, handle), reportedUser:profiles!reported_user_id(full_name, handle)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return camelize<MessageReport[]>(data);
}

export async function reviewMessageReport(
  reportId: string,
  action: "dismiss" | "suspend_user",
  note: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };
  const sb = await createClient();
  const { error } = await sb.rpc("admin_review_message_report", { p_report_id: reportId, p_action: action, p_note: note });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function submitIdentityVerification(
  userId: string,
  documentPath: string,
): Promise<{ ok: true; verification: IdentityVerification } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };

  const sb = await createClient();
  const { data, error } = await sb
    .from("identity_verifications")
    .insert({ user_id: userId, document_path: documentPath })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, verification: camelize<IdentityVerification>(data) };
}

/** The caller's own most recent submission — for their own status view. */
export async function getIdentityVerification(userId: string): Promise<IdentityVerification | null> {
  if (demoMode()) return null;

  const sb = await createClient();
  const { data } = await sb
    .from("identity_verifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? camelize<IdentityVerification>(data) : null;
}

/** A short-lived signed URL for viewing a private document — used by both
 * the submitter's own status page and the admin review queue. */
export async function getIdentityDocumentUrl(documentPath: string): Promise<string | null> {
  if (demoMode()) return null;

  const sb = await createClient();
  const { data } = await sb.storage.from(IDENTITY_BUCKET).createSignedUrl(documentPath, 60 * 10);
  return data?.signedUrl ?? null;
}

export async function listIdentityVerificationsAdmin(status?: KycStatus): Promise<IdentityVerification[]> {
  if (demoMode()) return [];

  const sb = await createClient();
  let query = sb
    .from("identity_verifications")
    .select("*, submitter:profiles!user_id(id, handle, full_name, avatar_url)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data } = await query;
  return (data ?? []).map((row) => camelize<IdentityVerification>(row));
}

export async function reviewIdentityVerification(
  verificationId: string,
  approve: boolean,
  note: string,
): Promise<{ ok: boolean; error?: string }> {
  if (demoMode()) return { ok: false, error: "Not available in demo mode." };

  const sb = await createClient();
  const { error } = await sb.rpc("admin_review_identity_verification", {
    p_verification_id: verificationId,
    p_approve: approve,
    p_note: note || null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
