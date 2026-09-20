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
export type PaymentMethod = "card" | "transfer" | "ussd" | "wallet";

export type WalletTxnType =
  | "topup"
  | "booking_payment"
  | "cancellation_credit"
  | "game_payment"
  | "game_refund"
  | "host_game_deposit"
  | "host_reimbursement"
  | "host_game_earnings"
  | "host_withdrawal"
  | "host_withdrawal_reversal";
export type WalletTxnStatus = "pending" | "completed" | "failed";

export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTxnType;
  status: WalletTxnStatus;
  /** Signed — positive is a credit, negative is a debit. */
  amountKobo: number;
  balanceAfterKobo: number | null;
  reference: string;
  provider: string | null;
  providerRef: string | null;
  bookingId: string | null;
  gameId: string | null;
  createdAt: string;
}

export interface HostBankAccount {
  id: string;
  userId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  updatedAt: string;
}

export interface HostPayoutRequest {
  id: string;
  userId: string;
  bankAccountId: string;
  amountKobo: number;
  status: "requested" | "paid" | "rejected";
  scheduledFor: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference: string;
  transferReference: string | null;
  adminNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

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
  activityType?: string;
  supportedActivities?: string[];
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy?: string | null;
  /** Resolved from verifiedBy when the admin's profile is joined/fetched. */
  verifiedByName?: string | null;
  verificationNote?: string | null;
  phone: string | null;
  amenities: string[];
  photos: string[];
  description: string;
  ownerId: string | null;
  createdAt: string;
}

/** One row per verify/unverify action — never overwritten, unlike
 * venues.verified_at/verified_by/verification_note which hold only the
 * current state. */
export interface VenueVerificationEvent {
  id: string;
  venueId: string;
  adminId: string;
  adminName?: string;
  verified: boolean;
  note: string | null;
  createdAt: string;
}

export interface Pitch {
  id: string;
  venueId: string;
  slug: string;
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
  checkInCode?: string;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  attendanceStatus?: "booked" | "checked_in" | "late" | "no_show" | "flagged";
  attendanceNote?: string | null;
  createdAt: string;
  slot?: Slot;
}

export interface Game {
  id: string;
  slug: string;
  pitchId: string;
  hostId: string;
  bookingId?: string | null;
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
  /** Players the host has already confirmed outside Tempo before publishing. */
  preconfirmedPlayerCount?: number;
  /** A game published from an already-confirmed Tempo pitch booking. */
  isExistingSession?: boolean;
  hostPaidKobo?: number;
  hostReimbursedKobo?: number;
  hostPitchCostKobo?: number;
  hostBookingFeeKobo?: number;
  hostEarningsKobo?: number;
  minimumDecisionDeadline?: string | null;
  minimumDecisionStatus?: "pending" | "go_ahead" | "cancelled" | "not_needed";
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
  status: "confirmed" | "waitlist" | "withdrawn" | "no_show" | "played" | "pending_payment";
  checkInCode?: string;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  minutesLate?: number | null;
  attendanceStatus?: "booked" | "checked_in" | "late" | "no_show" | "flagged" | "replaced";
  attendanceNote?: string | null;
  paymentDeadline?: string | null;
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
  /** Set only by admin_review_identity_verification() — never client-writable. */
  identityVerified: boolean;
  /** Self-service, defaults true. Gates reminder-style emails only — receipts
   * and security mail (OTP, refunds, cancellations) always send. */
  emailNotificationsEnabled: boolean;
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

/* ------------------------------------------------------------------
   Identity verification (KYC) — document upload + admin manual review.
   No phone/SMS OTP yet; see supabase/migrations/0018_identity_verification.sql.
   ------------------------------------------------------------------ */

export type KycStatus = "pending" | "approved" | "rejected";
export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface IdentityVerification {
  id: string;
  userId: string;
  documentPath: string;
  status: KycStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  submitter?: PlayerProfile;
}

export interface WaitlistLead {
  id: string;
  email: string | null;
  phone: string | null;
  area: string | null;
  role: UserRole;
  createdAt: string;
}

export interface VenueOwnerApplication {
  id: string;
  userId: string;
  venueName: string;
  area: string;
  address: string;
  phone: string | null;
  notes: string | null;
  status: ApplicationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  applicant?: PlayerProfile;
}

export interface GameChatMessage {
  id: string;
  gameId: string;
  userId: string;
  body: string;
  createdAt: string;
  player?: Pick<PlayerProfile, "id" | "fullName" | "handle" | "avatarUrl" | "initials">;
}

export interface DmThread {
  id: string;
  userA: string;
  userB: string;
  createdAt: string;
  lastMessageAt: string;
  userALastReadAt: string | null;
  userBLastReadAt: string | null;
  /** The OTHER participant's profile — resolved relative to the viewer, not userA/userB. */
  otherPlayer: Pick<PlayerProfile, "id" | "fullName" | "handle" | "avatarUrl" | "initials">;
  unread: boolean;
}

export interface DmMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export type MessageReportStatus = "pending" | "reviewed" | "dismissed";
export type MessageReportSource = "game_chat" | "direct_message";

export interface MessageReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  source: MessageReportSource;
  contextId: string;
  messageSnapshot: string;
  reason: string;
  status: MessageReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  reporter?: Pick<PlayerProfile, "fullName" | "handle">;
  reportedUser?: Pick<PlayerProfile, "fullName" | "handle">;
}

export type UserNotificationKind = "payment" | "waitlist_promoted" | "host_earnings" | "payout" | "game" | "system";

export interface UserNotification {
  id: string;
  userId: string;
  kind: UserNotificationKind;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}
