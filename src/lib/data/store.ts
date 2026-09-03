import type {
  Venue,
  Pitch,
  Game,
  GameParticipant,
  PlayerProfile,
  Slot,
  Booking,
  WalletTransaction,
} from "@/lib/types";
import {
  venues as seedVenues,
  pitches as seedPitches,
  games as seedGames,
  profiles as seedProfiles,
  generateSlots,
  buildParticipants,
} from "./seed";

/**
 * In-memory store for DEMO MODE — when no Supabase credentials are present.
 *
 * This exists so the app is fully playable the moment you run `npm run dev`,
 * with no account to create and no keys to paste. Every flow works: booking,
 * joining, waitlists, ratings. State lives for the life of the server process.
 *
 * The moment NEXT_PUBLIC_SUPABASE_URL is set, repo.ts routes to Postgres
 * instead and this file is never touched.
 */

interface Store {
  venues: Venue[];
  pitches: Pitch[];
  slots: Slot[];
  games: Omit<Game, "participants" | "filled">[];
  participants: GameParticipant[];
  profiles: PlayerProfile[];
  bookings: Booking[];
  /** userId -> balance in kobo. */
  wallets: Record<string, number>;
  walletTransactions: WalletTransaction[];
}

/** Every seeded demo player starts with this much wallet balance, so booking
 * keeps working in demo mode with no top-up step — same "every flow works"
 * goal the rest of this file states. */
const DEMO_STARTING_BALANCE_KOBO = 25_000_00;

declare global {
  // eslint-disable-next-line no-var
  var __tempoStore: Store | undefined;
}

function build(): Store {
  return {
    venues: structuredClone(seedVenues),
    pitches: structuredClone(seedPitches),
    slots: generateSlots(),
    games: seedGames.map(({ participantIds: _p, waitlistIds: _w, ...g }) => ({ ...g })),
    participants: buildParticipants(),
    profiles: structuredClone(seedProfiles),
    bookings: [],
    wallets: Object.fromEntries(
      seedProfiles.map((p) => [p.id, DEMO_STARTING_BALANCE_KOBO]),
    ),
    walletTransactions: [],
  };
}

/** Survives hot reload in dev; fresh per cold start in production. */
export function store(): Store {
  if (!globalThis.__tempoStore) globalThis.__tempoStore = build();
  return globalThis.__tempoStore;
}

export function resetStore() {
  globalThis.__tempoStore = build();
}
