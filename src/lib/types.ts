/**
 * Tempo domain types.
 * These mirror the Postgres schema in supabase/migrations/0001_init.sql
 */

export type PitchSurface = "astro" | "grass" | "indoor" | "concrete";
export type PitchSize = "5-a-side" | "7-a-side" | "11-a-side";
export type SkillLevel = "casual" | "intermediate" | "competitive";
export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Foot = "left" | "right" | "both";
export type UserRole = "player" | "host" | "venue_owner" | "admin";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "refunded";
export type GameStatus = "open" | "locked" | "cancelled" | "played";
export type PaymentMethod = "card" | "transfer" | "ussd";

export interface Venue {
  id: string;
  slug: string;
  name: string;
  area: string;
  /** "island" | "mainland" — Lagos' real geographic fault line */
  side: "island" | "mainland";
  address: string;
  lat: number;
  lng: number;
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy?: string | null;
  verificationNote?: string | null;
  phone: string | null;
  amenities: string[];
  photos: string[];
  description: string;
  ownerId: string | null;
  createdAt: string;
}

export interface Pitch {
  id: string;
  venueId: string;
  slug: string;
  name: string;
  size: PitchSize;
  surface: PitchSurface;
  floodlights: boolean;
  covered: boolean;
  /** Base price per hour in kobo (smallest unit) — never store money as float */
  pricePerHourKobo: number;
  /** Peak-hour multiplier, e.g. 1.3 for evenings */
  peakMultiplier: number;
  rating: number;
  reviewCount: number;
  active: boolean;
  venue?: Venue;
}

export interface Slot {
  id: string;
  pitchId: string;
  startsAt: string;
  endsAt: string;
  priceKobo: number;
  status: "open" | "held" | "booked" | "blocked";
  pitch?: Pitch;
}

export interface Booking {
  id: string;
  reference: string;
  slotId: string;
  userId: string;
  status: BookingStatus;
  totalKobo: number;
  paidKobo: number;
  paymentMethod: PaymentMethod | null;
  createdAt: string;
  slot?: Slot;
}

export interface Game {
  id: string;
  slug: string;
  pitchId: string;
  hostId: string;
  title: string;
  description: string;
  level: SkillLevel;
  startsAt: string;
  endsAt: string;
  capacity: number;
  /** How many spots must fill for the game to be guaranteed to go ahead */
  minimumToGuarantee: number;
  pricePerPlayerKobo: number;
  status: GameStatus;
  bibsProvided: boolean;
  createdAt: string;
  pitch?: Pitch;
  host?: PlayerProfile;
  participants?: GameParticipant[];
  /** Derived */
  filled?: number;
}

export interface GameParticipant {
  id: string;
  gameId: string;
  userId: string;
  joinedAt: string;
  paidKobo: number;
  status: "confirmed" | "waitlist" | "withdrawn" | "no_show" | "played";
  player?: PlayerProfile;
}

export interface PlayerProfile {
  id: string;
  handle: string;
  fullName: string;
  avatarUrl: string | null;
  /** Initials fallback */
  initials: string;
  area: string | null;
  position: Position | null;
  foot: Foot | null;
  bio: string | null;
  role: UserRole;
  /** Set only by admin_set_suspended() — never client-writable. */
  suspended: boolean;
  joinedAt: string;

  /* --- Identity & reputation --- */
  gamesPlayed: number;
  /** 0–100. Starts at 100, drops on no-shows and late arrivals. */
  punctualityScore: number;
  /** Consecutive weeks with at least one game played */
  streakWeeks: number;
  longestStreakWeeks: number;
  motmCount: number;
  /** Average peer rating out of 5 */
  peerRating: number | null;
  peerRatingCount: number;
  traits: PlayerTraits;
}

/** Peer-voted attributes, 0–100. Earned, never self-declared. */
export interface PlayerTraits {
  pace: number;
  passing: number;
  finishing: number;
  defending: number;
  stamina: number;
  teamwork: number;
}

export interface Rating {
  id: string;
  gameId: string;
  raterId: string;
  rateeId: string;
  score: number;
  motm: boolean;
  traitVote: keyof PlayerTraits | null;
  createdAt: string;
}

/* ------------------------------------------------------------------
   Match-day state — the heart of the "is this game happening?" question
   ------------------------------------------------------------------ */

export type MatchHeat = "cold" | "warm" | "hot" | "full";

export interface MatchState {
  filled: number;
  capacity: number;
  percent: number;
  spotsLeft: number;
  heat: MatchHeat;
  /** Has it hit the guarantee threshold? */
  guaranteed: boolean;
  label: string;
  /** ms until kickoff, negative if started */
  msToKickoff: number;
  isLive: boolean;
  hasEnded: boolean;
}

/* ------------------------------------------------------------------
   Waitlist — player area-interest signups and /partner venue-owner leads,
   distinguished only by `role`. No status column; admin dismisses a lead
   by deleting the row once it's been followed up on.
   ------------------------------------------------------------------ */

export interface WaitlistLead {
  id: string;
  email: string | null;
  phone: string | null;
  area: string | null;
  role: UserRole;
  createdAt: string;
}
