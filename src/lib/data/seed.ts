import type {
  Venue,
  Pitch,
  Game,
  PlayerProfile,
  GameParticipant,
  Slot,
} from "@/lib/types";

/**
 * Canonical seed data.
 *
 * Used two ways:
 *   1. Demo mode (no Supabase keys) — served straight from memory.
 *   2. `npm run seed` — pushed into a real Supabase project.
 *
 * Geography is real. Coordinates are real. The Island/Mainland split matters
 * because a 7pm kickoff across the Third Mainland Bridge is a different
 * proposition to one in your own area, and the product should know that.
 */

const now = new Date();

/** Build a date relative to today at a given hour, in local (WAT) terms. */
function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function plus(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/* ------------------------------------------------------------------ venues */

export const venues: Venue[] = [
  {
    id: "v-paradise",
    slug: "paradise-park-arena",
    name: "Paradise Park Arena",
    area: "Ikoyi",
    side: "island",
    address: "12 Glover Road, Ikoyi, Lagos",
    lat: 6.4541,
    lng: 3.4348,
    verified: true,
    verifiedAt: at(-60, 12),
    phone: "+2348031234567",
    amenities: ["Floodlights", "Showers", "Parking", "Security", "First aid", "Bibs"],
    photos: [],
    description:
      "Two full-size astro pitches behind the old tennis club. Gated, well lit, and the only place in Ikoyi where you can reliably get a game after 9pm.",
    ownerId: "p-folake",
    createdAt: at(-400, 9),
  },
  {
    id: "v-theyard",
    slug: "the-yard-lekki",
    name: "The Yard, Lekki",
    area: "Lekki Phase 1",
    side: "island",
    address: "Admiralty Way, Lekki Phase 1, Lagos",
    lat: 6.4478,
    lng: 3.4723,
    verified: true,
    verifiedAt: at(-45, 12),
    phone: "+2348027654321",
    amenities: ["Floodlights", "Showers", "Parking", "Security", "Cafe"],
    photos: [],
    description:
      "The busiest five-a-side spot on the Island. Three courts, floodlit until midnight, and a jollof stand that stays open as long as there's a game on.",
    ownerId: "p-folake",
    createdAt: at(-380, 9),
  },
  {
    id: "v-sabi",
    slug: "sabi-sports-centre",
    name: "Sabi Sports Centre",
    area: "Victoria Island",
    side: "island",
    address: "Ozumba Mbadiwe Avenue, Victoria Island, Lagos",
    lat: 6.4281,
    lng: 3.4219,
    verified: true,
    verifiedAt: at(-30, 12),
    phone: "+2348039876543",
    amenities: ["Floodlights", "Showers", "Parking", "Air conditioning", "Security"],
    photos: [],
    description:
      "Indoor, air-conditioned, and the only pitch in Lagos where the harmattan and the rain are somebody else's problem. Books out fast on weekday evenings.",
    ownerId: null,
    createdAt: at(-300, 9),
  },
  {
    id: "v-onikan",
    slug: "onikan-sports-hub",
    name: "Onikan Sports Hub",
    area: "Onikan",
    side: "island",
    address: "Cathedral Street, Onikan, Lagos Island",
    lat: 6.4433,
    lng: 3.4064,
    verified: true,
    verifiedAt: at(-20, 12),
    phone: "+2348051112233",
    amenities: ["Floodlights", "Parking", "Security", "Changing rooms"],
    photos: [],
    description:
      "Old-school Lagos Island ground, resurfaced in 2025. Cheapest verified pitch on the Island and it shows in how quickly the slots go.",
    ownerId: null,
    createdAt: at(-260, 9),
  },
  {
    id: "v-teslim",
    slug: "teslim-balogun-turf",
    name: "Teslim Balogun Turf",
    area: "Surulere",
    side: "mainland",
    address: "Teslim Balogun Stadium complex, Surulere, Lagos",
    lat: 6.4969,
    lng: 3.3481,
    verified: true,
    verifiedAt: at(-75, 12),
    phone: "+2348064445566",
    amenities: ["Floodlights", "Showers", "Parking", "Security", "Stands", "First aid"],
    photos: [],
    description:
      "Full eleven-a-side natural grass inside the stadium complex. Proper football, proper dugouts. Weekend mornings are booked months ahead by league sides.",
    ownerId: null,
    createdAt: at(-420, 9),
  },
  {
    id: "v-gra",
    slug: "gra-sports-club",
    name: "GRA Sports Club",
    area: "Ikeja GRA",
    side: "mainland",
    address: "Isaac John Street, Ikeja GRA, Lagos",
    lat: 6.5833,
    lng: 3.35,
    verified: true,
    verifiedAt: at(-15, 12),
    phone: "+2348077778899",
    amenities: ["Floodlights", "Parking", "Bar", "Security"],
    photos: [],
    description:
      "Members' club that opened its seven-a-side to the public in 2025. Quietest pitch on this list and the best surface north of the bridge.",
    ownerId: null,
    createdAt: at(-200, 9),
  },
  {
    id: "v-yaba",
    slug: "yaba-tech-turf",
    name: "Yaba Tech Turf",
    area: "Yaba",
    side: "mainland",
    address: "Herbert Macaulay Way, Yaba, Lagos",
    lat: 6.5095,
    lng: 3.3711,
    verified: false,
    verifiedAt: null,
    phone: "+2348090001122",
    amenities: ["Floodlights", "Parking"],
    photos: [],
    description:
      "Student-run pitch beside the polytechnic. Rough around the edges, cheapest game in Lagos, and never short of players.",
    ownerId: null,
    createdAt: at(-90, 9),
  },
];

/* ----------------------------------------------------------------- pitches */

export const pitches: Pitch[] = [
  {
    id: "pt-paradise-a",
    venueId: "v-paradise",
    slug: "paradise-park-arena-pitch-a",
    name: "Pitch A",
    size: "7-a-side",
    surface: "astro",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 4_000_000,
    peakMultiplier: 1.3,
    rating: 4.9,
    reviewCount: 518,
    active: true,
  },
  {
    id: "pt-paradise-b",
    venueId: "v-paradise",
    slug: "paradise-park-arena-pitch-b",
    name: "Pitch B",
    size: "5-a-side",
    surface: "astro",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 3_000_000,
    peakMultiplier: 1.3,
    rating: 4.8,
    reviewCount: 204,
    active: true,
  },
  {
    id: "pt-yard-1",
    venueId: "v-theyard",
    slug: "the-yard-lekki-court-1",
    name: "Court 1",
    size: "5-a-side",
    surface: "astro",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 3_000_000,
    peakMultiplier: 1.4,
    rating: 4.8,
    reviewCount: 342,
    active: true,
  },
  {
    id: "pt-yard-2",
    venueId: "v-theyard",
    slug: "the-yard-lekki-court-2",
    name: "Court 2",
    size: "7-a-side",
    surface: "astro",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 3_800_000,
    peakMultiplier: 1.4,
    rating: 4.7,
    reviewCount: 189,
    active: true,
  },
  {
    id: "pt-sabi",
    venueId: "v-sabi",
    slug: "sabi-sports-centre-indoor",
    name: "Indoor Arena",
    size: "5-a-side",
    surface: "indoor",
    floodlights: true,
    covered: true,
    pricePerHourKobo: 4_500_000,
    peakMultiplier: 1.25,
    rating: 4.7,
    reviewCount: 267,
    active: true,
  },
  {
    id: "pt-onikan",
    venueId: "v-onikan",
    slug: "onikan-sports-hub-main",
    name: "Main Pitch",
    size: "7-a-side",
    surface: "astro",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 2_200_000,
    peakMultiplier: 1.2,
    rating: 4.4,
    reviewCount: 156,
    active: true,
  },
  {
    id: "pt-teslim",
    venueId: "v-teslim",
    slug: "teslim-balogun-turf-main",
    name: "Main Bowl",
    size: "11-a-side",
    surface: "grass",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 5_000_000,
    peakMultiplier: 1.5,
    rating: 4.6,
    reviewCount: 421,
    active: true,
  },
  {
    id: "pt-gra",
    venueId: "v-gra",
    slug: "gra-sports-club-turf",
    name: "Club Turf",
    size: "7-a-side",
    surface: "astro",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 2_800_000,
    peakMultiplier: 1.2,
    rating: 4.5,
    reviewCount: 98,
    active: true,
  },
  {
    id: "pt-yaba",
    venueId: "v-yaba",
    slug: "yaba-tech-turf-main",
    name: "The Turf",
    size: "5-a-side",
    surface: "concrete",
    floodlights: true,
    covered: false,
    pricePerHourKobo: 1_200_000,
    peakMultiplier: 1.1,
    rating: 4.1,
    reviewCount: 73,
    active: true,
  },
];

/* ---------------------------------------------------------------- profiles */

function traits(
  pace: number,
  passing: number,
  finishing: number,
  defending: number,
  stamina: number,
  teamwork: number,
) {
  return { pace, passing, finishing, defending, stamina, teamwork };
}

export const profiles: PlayerProfile[] = [
  {
    id: "p-chidi",
    handle: "chidi",
    fullName: "Chidi Okonkwo",
    avatarUrl: null,
    initials: "CO",
    area: "Lekki Phase 1",
    position: "MID",
    foot: "right",
    bio: "Moved from Enugu in 2024. Play Tuesdays and Saturdays, will play anywhere in between.",
    role: "host",
    suspended: false,
    joinedAt: at(-500, 9),
    gamesPlayed: 87,
    punctualityScore: 96,
    streakWeeks: 14,
    longestStreakWeeks: 21,
    motmCount: 9,
    peerRating: 4.6,
    peerRatingCount: 71,
    traits: traits(72, 84, 61, 55, 78, 91),
  },
  {
    id: "p-amina",
    handle: "amina",
    fullName: "Amina Bello",
    avatarUrl: null,
    initials: "AB",
    area: "Ikoyi",
    position: "FWD",
    foot: "left",
    bio: "Left foot only. Don't pass it to my right.",
    role: "host",
    suspended: false,
    joinedAt: at(-460, 9),
    gamesPlayed: 64,
    punctualityScore: 100,
    streakWeeks: 9,
    longestStreakWeeks: 12,
    motmCount: 14,
    peerRating: 4.8,
    peerRatingCount: 58,
    traits: traits(88, 66, 92, 34, 71, 74),
  },
  {
    id: "p-tunde",
    handle: "tunde",
    fullName: "Tunde Adeyemi",
    avatarUrl: null,
    initials: "TA",
    area: "Ikeja GRA",
    position: "DEF",
    foot: "right",
    bio: "Centre back. I organise the Wednesday game at GRA.",
    role: "host",
    suspended: false,
    joinedAt: at(-520, 9),
    gamesPlayed: 112,
    punctualityScore: 88,
    streakWeeks: 3,
    longestStreakWeeks: 27,
    motmCount: 6,
    peerRating: 4.5,
    peerRatingCount: 94,
    traits: traits(48, 62, 31, 93, 69, 85),
  },
  {
    id: "p-folake",
    handle: "folake",
    fullName: "Folake Johnson",
    avatarUrl: null,
    initials: "FJ",
    area: "Lekki Phase 1",
    position: "MID",
    foot: "both",
    bio: "Run Paradise Park and The Yard. Still play when the numbers are short.",
    role: "venue_owner",
    suspended: false,
    joinedAt: at(-600, 9),
    gamesPlayed: 41,
    punctualityScore: 100,
    streakWeeks: 6,
    longestStreakWeeks: 15,
    motmCount: 3,
    peerRating: 4.4,
    peerRatingCount: 33,
    traits: traits(58, 77, 52, 64, 60, 88),
  },
  {
    id: "p-emeka",
    handle: "emeka",
    fullName: "Emeka Nwosu",
    avatarUrl: null,
    initials: "EN",
    area: "Victoria Island",
    position: "GK",
    foot: "right",
    bio: "Keeper. Available most Saturdays. Bring a proper ball.",
    role: "player",
    suspended: false,
    joinedAt: at(-300, 9),
    gamesPlayed: 53,
    punctualityScore: 92,
    streakWeeks: 7,
    longestStreakWeeks: 11,
    motmCount: 11,
    peerRating: 4.7,
    peerRatingCount: 47,
    traits: traits(41, 55, 12, 89, 63, 79),
  },
  {
    id: "p-yemi",
    handle: "yemi",
    fullName: "Yemi Alabi",
    avatarUrl: null,
    initials: "YA",
    area: "Surulere",
    position: "FWD",
    foot: "right",
    bio: "Eleven-a-side or nothing. Surulere born.",
    role: "host",
    suspended: false,
    joinedAt: at(-350, 9),
    gamesPlayed: 76,
    punctualityScore: 74,
    streakWeeks: 0,
    longestStreakWeeks: 18,
    motmCount: 8,
    peerRating: 4.2,
    peerRatingCount: 62,
    traits: traits(81, 59, 86, 40, 74, 58),
  },
  {
    id: "p-ifeoluwa",
    handle: "ifeoluwa",
    fullName: "Ifeoluwa Tejumola",
    avatarUrl: null,
    initials: "IT",
    area: "Yaba",
    position: "MID",
    foot: "right",
    bio: "Building Tempo. Playing while I build it.",
    role: "player",
    suspended: false,
    joinedAt: at(-30, 9),
    gamesPlayed: 6,
    punctualityScore: 100,
    streakWeeks: 3,
    longestStreakWeeks: 3,
    motmCount: 1,
    peerRating: 4.3,
    peerRatingCount: 5,
    traits: traits(64, 70, 55, 48, 66, 72),
  },
  {
    id: "p-seun",
    handle: "seun",
    fullName: "Seun Okoro",
    avatarUrl: null,
    initials: "SO",
    area: "Gbagada",
    position: "DEF",
    foot: "left",
    bio: null,
    role: "player",
    suspended: false,
    joinedAt: at(-180, 9),
    gamesPlayed: 29,
    punctualityScore: 81,
    streakWeeks: 2,
    longestStreakWeeks: 8,
    motmCount: 2,
    peerRating: 4.1,
    peerRatingCount: 24,
    traits: traits(55, 58, 37, 76, 62, 69),
  },
  {
    id: "p-bisi",
    handle: "bisi",
    fullName: "Bisi Adeleke",
    avatarUrl: null,
    initials: "BA",
    area: "Ikoyi",
    position: "MID",
    foot: "right",
    bio: "Box to box. Never miss a Tuesday.",
    role: "player",
    suspended: false,
    joinedAt: at(-240, 9),
    gamesPlayed: 48,
    punctualityScore: 98,
    streakWeeks: 11,
    longestStreakWeeks: 11,
    motmCount: 4,
    peerRating: 4.5,
    peerRatingCount: 39,
    traits: traits(69, 73, 58, 61, 87, 80),
  },
  {
    id: "p-kunle",
    handle: "kunle",
    fullName: "Kunle Bakare",
    avatarUrl: null,
    initials: "KB",
    area: "Lekki Phase 1",
    position: "FWD",
    foot: "right",
    bio: null,
    role: "player",
    suspended: false,
    joinedAt: at(-120, 9),
    gamesPlayed: 18,
    punctualityScore: 67,
    streakWeeks: 0,
    longestStreakWeeks: 4,
    motmCount: 1,
    peerRating: 3.8,
    peerRatingCount: 15,
    traits: traits(77, 48, 71, 29, 55, 44),
  },
];

/* -------------------------------------------------------------------- games */

interface SeedGame extends Omit<Game, "participants" | "filled"> {
  participantIds: string[];
  waitlistIds?: string[];
}

export const games: SeedGame[] = [
  {
    id: "g-tuesday-yard",
    slug: "tuesday-night-yard-lekki",
    pitchId: "pt-yard-1",
    hostId: "p-chidi",
    title: "Tuesday Night Regulars",
    description:
      "Been running this one for two years. Competitive but nobody's trying to break an ankle. Bibs provided, bring white and dark.",
    level: "intermediate",
    startsAt: at(0, 19),
    endsAt: at(0, 20, 30),
    capacity: 10,
    minimumToGuarantee: 8,
    pricePerPlayerKobo: 1_500_000,
    status: "open",
    bibsProvided: true,
    createdAt: at(-14, 10),
    participantIds: ["p-chidi", "p-bisi", "p-kunle", "p-seun", "p-ifeoluwa", "p-emeka", "p-amina"],
  },
  {
    id: "g-ikoyi-casual",
    slug: "ikoyi-friday-casual",
    pitchId: "pt-paradise-a",
    hostId: "p-amina",
    title: "Friday Wind-Down",
    description:
      "Relaxed seven-a-side to end the week. All levels genuinely welcome — we've had complete beginners and ex-academy in the same game.",
    level: "casual",
    startsAt: at(1, 20),
    endsAt: at(1, 21, 30),
    capacity: 14,
    minimumToGuarantee: 10,
    pricePerPlayerKobo: 1_200_000,
    status: "open",
    bibsProvided: true,
    createdAt: at(-10, 10),
    participantIds: [
      "p-amina", "p-folake", "p-bisi", "p-chidi", "p-seun",
      "p-emeka", "p-kunle", "p-tunde", "p-ifeoluwa", "p-yemi",
    ],
  },
  {
    id: "g-gra-wednesday",
    slug: "gra-wednesday-competitive",
    pitchId: "pt-gra",
    hostId: "p-tunde",
    title: "GRA Midweek — Competitive",
    description:
      "We keep score, we play to win, and we shake hands after. If you don't track back, this isn't your game.",
    level: "competitive",
    startsAt: at(2, 18, 30),
    endsAt: at(2, 20),
    capacity: 14,
    minimumToGuarantee: 12,
    pricePerPlayerKobo: 1_000_000,
    status: "open",
    bibsProvided: false,
    createdAt: at(-7, 10),
    participantIds: [
      "p-tunde", "p-yemi", "p-seun", "p-kunle", "p-chidi",
      "p-bisi", "p-emeka", "p-amina", "p-folake", "p-ifeoluwa", "p-seun",
    ].filter((v, i, a) => a.indexOf(v) === i),
  },
  {
    id: "g-sabi-saturday",
    slug: "sabi-saturday-morning",
    pitchId: "pt-sabi",
    hostId: "p-emeka",
    title: "Saturday Morning Indoor",
    description:
      "7am start, air-conditioned, done by 8:30 so you still have your Saturday. Best game in Lagos if you hate the heat.",
    level: "intermediate",
    startsAt: at(3, 7),
    endsAt: at(3, 8, 30),
    capacity: 10,
    minimumToGuarantee: 8,
    pricePerPlayerKobo: 2_000_000,
    status: "open",
    bibsProvided: true,
    createdAt: at(-5, 10),
    participantIds: ["p-emeka", "p-bisi", "p-chidi", "p-ifeoluwa"],
  },
  {
    id: "g-teslim-eleven",
    slug: "teslim-sunday-eleven",
    pitchId: "pt-teslim",
    hostId: "p-yemi",
    title: "Sunday Eleven-a-Side",
    description:
      "Full 11v11 on grass. Proper football with subs on the bench. Two hours, referee included in the price.",
    level: "competitive",
    startsAt: at(4, 16),
    endsAt: at(4, 18),
    capacity: 22,
    minimumToGuarantee: 18,
    pricePerPlayerKobo: 800_000,
    status: "open",
    bibsProvided: false,
    createdAt: at(-12, 10),
    participantIds: [
      "p-yemi", "p-tunde", "p-seun", "p-kunle", "p-chidi", "p-bisi",
      "p-emeka", "p-amina", "p-folake", "p-ifeoluwa",
    ],
  },
  {
    id: "g-yaba-cheap",
    slug: "yaba-thursday-kickabout",
    pitchId: "pt-yaba",
    hostId: "p-ifeoluwa",
    title: "Yaba Thursday Kickabout",
    description:
      "Cheapest game on Tempo. Concrete surface so wear proper trainers, not studs. Good crowd, mostly students.",
    level: "casual",
    startsAt: at(5, 18),
    endsAt: at(5, 19, 30),
    capacity: 10,
    minimumToGuarantee: 6,
    pricePerPlayerKobo: 500_000,
    status: "open",
    bibsProvided: false,
    createdAt: at(-3, 10),
    participantIds: ["p-ifeoluwa", "p-seun", "p-kunle"],
  },
];

/* -------------------------------------------------------------------- slots */

/**
 * Generate a week of hourly slots per pitch, 6am–10pm, marking a plausible
 * scatter as already booked so availability looks and behaves like a real
 * venue's calendar.
 */
export function generateSlots(days = 14): Slot[] {
  const out: Slot[] = [];
  for (const pitch of pitches) {
    for (let d = 0; d < days; d++) {
      for (let h = 6; h <= 21; h++) {
        const startsAt = at(d, h);
        // Peak = weekday evenings 5pm–9pm
        const dow = new Date(startsAt).getDay();
        const weekday = dow >= 1 && dow <= 5;
        const peak = weekday && h >= 17 && h <= 20;
        const price = Math.round(
          pitch.pricePerHourKobo * (peak ? pitch.peakMultiplier : 1),
        );

        // Deterministic pseudo-random so the demo is stable across reloads
        const hash =
          (pitch.id.charCodeAt(3) * 31 + d * 17 + h * 7) % 100;
        let status: Slot["status"] = "open";
        if (peak && hash < 55) status = "booked";
        else if (hash < 18) status = "booked";
        if (d === 0 && h <= new Date().getHours()) status = "blocked";

        out.push({
          id: `s-${pitch.id}-${d}-${h}`,
          pitchId: pitch.id,
          startsAt,
          endsAt: plus(startsAt, 60),
          priceKobo: price,
          status,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ participants */

export function buildParticipants(): GameParticipant[] {
  const out: GameParticipant[] = [];
  for (const g of games) {
    g.participantIds.forEach((uid, i) => {
      out.push({
        id: `gp-${g.id}-${uid}`,
        gameId: g.id,
        userId: uid,
        joinedAt: at(-6 + i, 12),
        paidKobo: g.pricePerPlayerKobo,
        status: "confirmed",
      });
    });
    (g.waitlistIds ?? []).forEach((uid, i) => {
      out.push({
        id: `gp-wl-${g.id}-${uid}`,
        gameId: g.id,
        userId: uid,
        joinedAt: at(-1, 12 + i),
        paidKobo: 0,
        status: "waitlist",
      });
    });
  }
  return out;
}
