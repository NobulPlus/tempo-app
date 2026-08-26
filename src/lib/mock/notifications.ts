import { at } from "./helpers";

export type NotificationType = "game_created" | "reminder" | "waitlist_promoted" | "joined";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
}

/**
 * What "everyone gets notified when a game is created" looks like in-app.
 * The first entry is that exact case — a fresh game, unread, at the top.
 */
export const notifications: Notification[] = [
  {
    id: "n-1",
    type: "game_created",
    title: "New game near you",
    body: "Zainab just opened Friday Wind-Down at Bourdillon Arena, Ikoyi — 5 spots left.",
    href: "/games/ikoyi-friday-wind-down",
    createdAt: at(0, 9, 12),
    read: false,
  },
  {
    id: "n-2",
    type: "reminder",
    title: "Kickoff in 2 hours",
    body: "Tuesday Night Regulars at The Pitch House starts at 7pm. Leave by 6:20 to beat traffic.",
    href: "/games/tuesday-night-pitch-house",
    createdAt: at(0, 5, 0),
    read: false,
  },
  {
    id: "n-3",
    type: "waitlist_promoted",
    title: "You're in!",
    body: "A spot opened up in Agidingbi Midweek — Competitive. You've been moved off the waitlist.",
    href: "/games/agidingbi-midweek-competitive",
    createdAt: at(-1, 18, 30),
    read: true,
  },
  {
    id: "n-4",
    type: "game_created",
    title: "New game near you",
    body: "David just opened Agidingbi Midweek — Competitive at Agidingbi Sports Park, Ikeja GRA.",
    href: "/games/agidingbi-midweek-competitive",
    createdAt: at(-2, 11, 0),
    read: true,
  },
];
