import type { Game, GameParticipant } from "@/lib/types";
import { at } from "./helpers";

interface SeedGame extends Omit<Game, "participants" | "filled"> {
  participantIds: string[];
  waitlistIds?: string[];
}

export const games: SeedGame[] = [
  {
    id: "g-lekki-tuesday",
    slug: "tuesday-night-pitch-house",
    pitchId: "pt-house-a",
    hostId: "p-tomiwa",
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
    participantIds: ["p-tomiwa", "p-funmi", "p-segun", "p-nonso", "p-chiamaka", "p-halima", "p-zainab"],
  },
  {
    id: "g-ikoyi-friday",
    slug: "ikoyi-friday-wind-down",
    pitchId: "pt-bourdillon-a",
    hostId: "p-zainab",
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
      "p-zainab", "p-tomiwa", "p-funmi", "p-halima", "p-nonso",
      "p-chiamaka", "p-segun", "p-david", "p-bayo",
    ],
  },
  {
    id: "g-gra-wednesday",
    slug: "agidingbi-midweek-competitive",
    pitchId: "pt-agidingbi",
    hostId: "p-david",
    title: "Agidingbi Midweek — Competitive",
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
      "p-david", "p-bayo", "p-nonso", "p-segun", "p-tomiwa",
      "p-funmi", "p-halima", "p-zainab",
    ],
  },
  {
    id: "g-vi-saturday",
    slug: "marina-saturday-morning",
    pitchId: "pt-marina",
    hostId: "p-halima",
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
    participantIds: ["p-halima", "p-funmi", "p-tomiwa", "p-chiamaka"],
  },
  {
    id: "g-surulere-sunday",
    slug: "teslim-sunday-eleven",
    pitchId: "pt-teslimb",
    hostId: "p-bayo",
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
      "p-bayo", "p-david", "p-nonso", "p-segun", "p-tomiwa", "p-funmi",
      "p-halima", "p-zainab", "p-chiamaka",
    ],
  },
  {
    id: "g-yaba-thursday",
    slug: "yaba-thursday-kickabout",
    pitchId: "pt-herbertmac",
    hostId: "p-chiamaka",
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
    participantIds: ["p-chiamaka", "p-nonso", "p-segun"],
  },
];

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
