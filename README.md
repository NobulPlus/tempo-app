# Tempo

**Find a facility, book a facility, join a game.** Sports infrastructure for
Lagos, Nigeria — starting with football, built to expand beyond it.

Tempo solves three real, specific problems for recreational football in
Lagos: finding a verified place to play, booking it without a phone call and
a "the pitch is actually double-booked" surprise, and joining a pickup game
with people who reliably show up. It is not a generic sports-booking clone —
every product decision below (traffic-aware "leave by" times, the
Island/Mainland geography split, kobo-denominated pricing, punctuality as a
tracked number) exists because it's what organising football in Lagos
specifically requires.

**Status: live.** The app is deployed on Vercel, backed by a real Supabase
Postgres database — not the in-memory demo mode described below, which only
runs when no database is configured (e.g. a fresh local clone with no
`.env.local`).

---

## Contents

1. [Product overview](#product-overview)
2. [Tech stack](#tech-stack)
3. [Domain model](#domain-model)
4. [How it's architected](#how-its-architected)
5. [The Postgres schema](#the-postgres-schema)
6. [Business logic worth knowing](#business-logic-worth-knowing)
7. [Design system](#design-system)
8. [Full page inventory](#full-page-inventory)
9. [Hosting & going live](#hosting--going-live)
10. [Running the project](#running-the-project)
11. [Known limitations / open follow-ups](#known-limitations--open-follow-ups)

---

## Product overview

**Who it's for:** recreational and semi-serious footballers in Lagos who
currently organise games over WhatsApp and phone calls — plus the venue
owners renting out pitches and the hosts running weekly games.

**The three core flows:**
- **Find & book a pitch** — browse verified venues, real availability, pay by
  card/transfer/USSD, get a confirmation with a shareable reference and a
  traffic-aware "leave by" time.
- **Join an open game** — browse games that need players, see exactly how
  many spots are left and whether the game is "guaranteed" to go ahead, join
  solo, get waitlisted automatically if it's full.
- **Host a game** — pick a pitch and slot, set a capacity and a minimum
  headcount to guarantee it, get pricing guidance, watch it fill live.

Supporting flows: venue-owner onboarding and a dashboard (utilisation,
revenue), a player reputation system (see below), and a public player
profile/card.

---

## Tech stack

- **Next.js 16** (App Router, React Server Components + Server Actions)
- **TypeScript**, strict
- **Tailwind CSS 4** (CSS-first `@theme` configuration, no `tailwind.config.js`)
- **Supabase** (Postgres, Auth, Row-Level Security)
- **Zod** for input validation on server actions
- **date-fns** for date arithmetic
- No component library, no CSS-in-JS, no state-management library — deliberately.
  Server Components fetch data directly; client interactivity is `useState`/
  `useActionState` and a handful of small hooks.

---

## Domain model

Defined once in `src/lib/types.ts`, mirrored exactly by the Postgres schema
(comment in the file literally says so). The core entities:

- **`Venue`** — a physical location: name, area (e.g. "Lekki Phase 1"), a
  Lagos-specific `side: "island" | "mainland"`, lat/lng, amenities, photos,
  and a `verified`/`verifiedAt` pair (verification is a public claim, so it
  carries a timestamp — see [`/verification`](#full-page-inventory) for what
  that claim actually means).
- **`Pitch`** — one bookable surface at a venue: size (`5-a-side` /
  `7-a-side` / `11-a-side`), surface (`astro` / `grass` / `indoor` /
  `concrete`), floodlights/covered flags, `pricePerHourKobo` and a
  `peakMultiplier` for evening pricing.
- **`Slot`** — one bookable hour on one pitch, with a status
  (`open`/`held`/`booked`/`blocked`).
- **`Booking`** — a paid reservation of a slot: reference code, status,
  amounts in kobo (including the 5% service fee, computed once server-side —
  see `computeBookingTotal()` in `lib/data/repo.ts`), payment method.
- **`Game`** — an open pickup game hosted on a pitch at a specific time:
  capacity, `minimumToGuarantee` (how many players must join before it's
  locked in), `pricePerPlayerKobo`, skill `level`.
- **`GameParticipant`** — a player's membership in a game:
  `confirmed`/`waitlist`/`withdrawn`/`no_show`/`played`.
- **`PlayerProfile`** — handle, position, foot, bio, role
  (`player`/`host`/`venue_owner`), and the entire reputation block below.
  Phone number lives in a separate `profiles_private` table with no public
  read policy — never on the public profile row.
- **`PlayerTraits`** — six peer-voted attributes (pace, passing, finishing,
  defending, stamina, teamwork), 0–100, rendered as a hexagon radar chart.
- **`MatchState`** (derived, not stored) — the single computed answer to "is
  this game happening?": `heat` (`cold`/`warm`/`hot`/`full`), `label`,
  `percent` filled, `spotsLeft`, `guaranteed`, `isLive`, `hasEnded`,
  `msToKickoff`.

Money is **always** an integer number of kobo (1/100 Naira) — never a float,
never a formatted string, at the type level. `formatNaira()` in
`lib/format.ts` is the only function allowed to turn it into display text.

---

## How it's architected

There is no separate backend API. The "backend" is Postgres plus a thin
Next.js layer:

- **Server Components fetch data directly** during render — no client-side
  data-fetching library, no REST/GraphQL layer.
- **Server Actions** (`src/app/actions.ts`, `"use server"`) handle every
  mutation: joining a game, creating a booking, hosting a game, signing up,
  requesting a password reset. Client Components call them like local
  functions; Zod validates input; `revalidatePath()` refreshes the affected
  routes afterward.
- **`src/lib/data/repo.ts` is the single data-access layer.** Every page and
  action goes through it — never straight to Supabase. Internally it
  branches on `demoMode()`: with no Supabase credentials configured, it reads
  and writes an in-memory store (`lib/data/store.ts`, seeded from
  `lib/data/seed.ts`); with credentials present, it queries Postgres. Pages
  don't know or care which mode they're in. That's *why* `npm run dev` works
  with zero setup out of the box, and why demo mode is still a first-class
  citizen even though the deployed app runs on real Postgres.
- **Auth** (`src/lib/session.ts`) follows the same pattern: a real Supabase
  session via `sb.auth.getUser()`, or in demo mode a cookie
  (`tempo_demo_user`) holding a seeded profile ID, so you can sign in as any
  seeded player, host, or venue owner without a backend. A suspended account
  is signed out the moment `getCurrentUser()` sees the flag, so every action
  gating on a non-null user already blocks a suspended one for free.
- **`src/lib/supabase/{server,client}.ts`** wrap `@supabase/ssr`'s
  cookie-aware client creation for Server Components/Actions and Client
  Components respectively.
- **`src/app/auth/confirm/route.ts`** is a plain Route Handler, not a Server
  Action — because it's where an *external* click (an email link) lands, and
  Server Actions are only invocable from within the app. It verifies
  Supabase's `token_hash`/`type` pair for both email confirmation and
  password recovery, then redirects to a same-origin-checked `next` path
  (`safeNext()` in `lib/url.ts` — blocks open-redirect attempts).

The one other thing this architecture can't do itself: anything an
**external** service needs to call, like a Paystack payment webhook — that's
also a Route Handler, and it's the one piece not built yet (see "Known
limitations").

---

## The Postgres schema

`supabase/migrations/` — the schema is where a lot of Tempo's actual
correctness guarantees live, not in application code. Run every file in
order; later migrations aren't optional extras, they fix real bugs found in
a live-readiness audit and the app assumes they're applied:

- **`0001_init.sql`** — every table, RLS policies, reputation triggers, and
  the double-booking exclusion constraint.
- **`0002_auth_hardening.sql`** — closes a signup privilege-escalation gap
  and locks `role`/`suspended` behind admin-only functions instead of a
  normal `UPDATE`.
- **`0003_fix_handle_generation.sql`** — a handle-generation edge case that
  broke signup for long email local-parts.
- **`0004_flatten_ranges.sql`** — generated `starts_at`/`ends_at` columns
  alongside the `tstzrange` columns, since every application-layer query
  needs plain timestamps, not range literals.
- **`0005_host_game.sql`** — the atomic `host_game()` function.
- **`0006_create_booking.sql`** — the atomic `create_booking()` function
  (real bookings didn't write to Postgres at all before this).
- **`0007_game_function_fixes.sql`** — fixes a bug where a full game
  rejected *every* join instead of waitlisting late joiners, a bug where
  leaving a game you were never in could wrongly promote someone else off
  the waitlist, and adds a `suspended` check to every write function.
- **`0008_profile_column_privacy.sql`** / **`0009_fix_profile_privacy.sql`**
  — 0008's column-grant approach to hiding `profiles.phone` broke
  `select("*")` everywhere (confirmed against the live database); 0009
  reverts that and moves `phone` into `profiles_private` instead, which has
  no public read policy at all.

What the schema guarantees, independent of which migration added it:

- **Money is `bigint` kobo** everywhere, matching the TypeScript types exactly.
- **Double-booking is prevented at the database level.** `slots` carries a
  GiST exclusion constraint (`using btree_gist`) on `(pitch_id, during)` —
  two overlapping slots on the same pitch cannot exist, full stop. An
  application-level "check then insert" loses this race under concurrent
  requests; a database constraint cannot.
- **Joining a game, leaving a game, hosting a game, and booking a pitch are
  all atomic.** Each is a `SECURITY DEFINER` Postgres function that locks the
  relevant row, does its reads and writes inside one transaction, and
  returns — so two people tapping the same button simultaneously can never
  both win.
- **Reputation is derived, never declared.** Punctuality starts at 100 and
  drops on no-shows/lateness; traits move only from peer votes cast after a
  shared game; streaks count consecutive ISO weeks played. All maintained by
  triggers, so no client can write its own rating.
- **Row-Level Security is default-deny.** Every table is locked, then opened
  deliberately per policy — e.g. a payment row is readable only by the user
  who made it; you can rate someone only if you played the same game as them,
  after it ended.
- **`profiles` mirrors `auth.users`** via a foreign key plus an
  `after insert on auth.users` trigger — Supabase owns credentials, the app
  owns everything else about a person, and a player's phone number lives
  somewhere neither RLS's `using (true)` public-read policy nor a stray
  `select("*")` can ever expose it to anyone but its owner.

## Business logic worth knowing

- **`getMatchState()`** (`lib/match.ts`) is the single source of truth for
  "what state is this game in?" — it derives `heat`, `label`, `guaranteed`,
  `spotsLeft` from real numbers on every call, so the UI badge and the actual
  roster can never disagree. Nothing about match state is a stored, cached
  field that can go stale.
- **Lagos traffic is a first-class product concern**, not an afterthought:
  `estimateTravelMinutes()` applies rough, honestly-labelled multipliers for
  weekday rush hours and Island/Mainland bridge crossings, and
  `leaveByTime()` turns that into the literal time you need to leave home —
  shown prominently on both the pitch and game detail pages.
- **`formatCountdown()`** is deliberately coarse above an hour (`"2d 4h"`,
  not `"2 days, 4 hours, 17 minutes, 3 seconds"`) — nobody needs
  second-level precision for a game three days out.
- **The homepage's copy is deliberately sport-agnostic** ("Play sports",
  "find a facility") even though the product is football-only today — the
  rest of the app (routes, data model, filters) still describes football
  specifically, since that's genuinely all it does right now.

---

## Design system

**"Matchday, not SaaS dashboard."** Dark navy-and-green background, bold stat
callouts, a pitch-marking decorative motif, live countdown/fill-bar
mechanics — grounded in three concrete references reviewed directly as
screenshots, not guessed from descriptions: [Footy
Addicts](https://footyaddicts.com) (editorial match photography, doodle
icons, handwritten accent taglines), [Playtomic](https://playtomic.com)
(confident colour-blocked sections, numbered step badges), and Tempo's own
original pitch-green brand hue.

The living, interactive version of the full token set is at **`/system`** —
run the app and open it.

### Colour

Dark-first, with a genuine light mode on top (every token redefines under
`prefers-color-scheme: light` / an explicit `data-theme` toggle — nothing is
a hard-coded colour).

| Token | Dark value | Role |
|---|---|---|
| `--color-bg-primary` | `#0b0f0c` | Base background |
| `--color-bg-secondary` | `#0f2318` | Alternating full-bleed section band |
| `--color-bg-card` | `#141a15` | Card surface |
| `--color-ink` / `--color-ink-soft` / `--color-ink-muted` | `#f3f6f1` / `#b7c2b4` / `#8b978a` | Text, WCAG-AA checked |
| `--color-green` / `--color-green-deep` | `#17b95c` / `#0e8a44` | Brand accent |
| `--color-gold` | `#f5a623` | "Floodlight" — the match-heat *warm* state |
| `--color-orange` | `#ff5a45` | Coral — the match-heat *hot* state |
| `--color-blue` / `--color-purple` | `#4c8dff` / `#a78bfa` | *Cold*/casual and competitive-level tags respectively |

### Typography

Four faces, each with one job, loaded via `next/font/google` (self-hosted,
no layout shift):

- **Bricolage Grotesque** (display) — headlines and the big stat callouts.
- **Figtree** (body) — everything you actually read.
- **Caveat** (accent) — a handwritten script used *sparingly*, only for
  taglines/emphasis.
- **JetBrains Mono** (data) — prices, countdowns, fill fractions — anywhere
  digits need to line up, with `tabular-nums`.

### Layout & components

- Alternating full-bleed colour-blocked section bands, bento-style spotlight
  grids on the homepage, and scroll-triggered reveals (`components/ui/reveal.tsx`,
  an `IntersectionObserver` primitive that respects `prefers-reduced-motion`)
  instead of a single flat page of uniform card grids.
- **`src/components/ui/`** — shared primitives: `Reveal`, `OptionRow` (the
  one "bordered selectable row" component used by the host form, checkout,
  and level pickers, instead of three hand-rolled copies), `StepBadge`,
  `TestimonialCard`.
- **Icons** stay hand-rolled inline SVG (`components/icons.tsx`, one
  component each, no library) — plus a second tier of deliberately looser
  "doodle" icons (`DoodleFindIcon`, `DoodleBookIcon`, `DoodlePlayIcon`)
  reserved for the homepage's "how it works" storytelling section.
- **Footer** has an area-based link block ("Play sports in Lekki / Ikoyi /
  …"), generated from the real distinct areas in the database.
- **Hero video**: a looping, muted, license-free football clip (sourced from
  Mixkit, no attribution required) with a grain-texture overlay.
  `prefers-reduced-motion` swaps it for a static frame via pure CSS
  (`motion-safe:`/`motion-reduce:`), no JS.

---

## Full page inventory

| Route | What it is |
|---|---|
| `/` | Landing — video hero, honest live stats, numbered "Find/Book/Play" steps, bento feature grid, spotlight pitch, testimonials, area-based footer |
| `/pitches` | Discovery — search, area/size filters, sort by near/cheap/rated, spotlight result |
| `/pitches/[slug]` | Pitch detail — venue info, amenities, slot picker, games happening there |
| `/pitches/[slug]/book` | Checkout — payment method, fee-inclusive total |
| `/bookings/[reference]` | Booking confirmation |
| `/games` | Open games — search, level/when/side filters, spotlight soonest game |
| `/games/[slug]` | Game detail — live fill bar, countdown, roster + waitlist, join button, "when to leave," host card |
| `/host` | Host a game — slot picker, pricing guidance with live-computed warnings |
| `/players` | Player directory |
| `/players/[handle]` | Player card — trait radar, punctuality ring, streak, upcoming games, how reputation works |
| `/dashboard` | Games joined/hosting, bookings, reputation strip, streak nudge, notification preferences |
| `/venue` | Venue-owner dashboard — utilisation, projected revenue, upcoming bookings per pitch |
| `/partner` | Venue-owner onboarding — leaves an interest lead for the team to follow up |
| `/verification` | What the "Verified by Tempo" badge actually means, step by step |
| `/login`, `/signup`, `/reset`, `/reset/confirm` | Auth — real Supabase password auth when configured, seeded demo sign-in otherwise |
| `/legal/{terms,privacy,refunds,community}` | Legal pages |
| `/setup` | Live setup checklist — shows whether the deploy is running demo mode or a real database |
| `/system` | The design-system style guide |

---

## Hosting & going live

- **App:** Vercel — zero-config for Next.js App Router + Server Actions.
- **Database:** Supabase specifically, not generic Postgres — the schema's
  RLS policies are keyed to `auth.uid()` and a trigger fires on
  `auth.users` insert, so swapping to raw RDS/Azure Postgres would mean
  rebuilding auth from scratch for no functional gain.
- **Rejected alternatives:** Namecheap/cPanel (MySQL only, no Postgres),
  Railway/DigitalOcean (workable but would mean self-hosting Supabase's
  auth/RLS layer to keep cost down), AWS/Azure (higher monthly floor —
  ALB/App Runner/App Service minimums — plus a Cognito/Azure AD B2C rebuild
  to replace what Supabase gives for free).
- **Indicative pricing** (self-serve, checked directly against vercel.com/
  pricing and supabase.com/pricing): **$0/mo** free tier for evaluation only
  (Vercel Hobby is non-commercial-use licensed; Supabase Free projects pause
  after 7 days idle — not viable for a live product taking real traffic);
  **~$45/mo** at a proper launch tier (Vercel Pro $20/seat + Supabase Pro
  $25); no published self-serve annual discount on either platform as of
  this writing.
- **Domain:** a custom domain works on Vercel regardless of plan tier — point
  an `A` record (apex) and `CNAME` (`www`) at the values Vercel's Domains tab
  shows for your project. New domains can take longer than the DNS TTL
  suggests to fully resolve everywhere, independent of any record change,
  due to registrar-side onboarding holds.
- **Still open before real payments:** Paystack integration — the `payments`
  table and checkout UI exist; the initialise call and webhook handler
  don't. A booking today is confirmed as a real, durable Postgres row with
  the correct fee-inclusive total, it just doesn't move real money yet — the
  checkout UI says so honestly.

### Before the first real booking

- [ ] Read Terms, Privacy and Refunds and make every sentence true for you —
      the Refunds page currently describes automatic refunds as fully live;
      reconcile that with Paystack not being wired up yet
- [ ] Put real inboxes behind `hello@` `help@` `safety@` `privacy@`
- [ ] Visit and photograph every venue marked verified — the site claims you did
- [ ] Wire Paystack's initialise call and webhook handler
- [ ] Register with the Nigeria Data Protection Commission if required for your scale

---

## Running the project

```bash
npm install
npm run dev          # demo mode with zero setup, or real Postgres if .env.local is configured
npm run build         # production build
npm run start         # serve the build
npm run type-check    # tsc --noEmit
npm run lint           # eslint
npm run seed           # push seed data to a real Supabase project (needs SUPABASE_SERVICE_ROLE_KEY)
```

Open <http://localhost:3000>. No keys, no accounts required for demo mode —
sign in as any seeded player from the login page to experience the product
as a player, a host, or a venue owner.

When you're ready for a real database, follow the checklist on `/setup`
(also mirrored there in-app): create a Supabase project, run every file in
`supabase/migrations/` in order, copy `.env.example` to `.env.local`, then
`npm run seed`.

---

## Known limitations / open follow-ups

- **Paystack isn't wired up yet** — initialise call + webhook handler both
  outstanding. Bookings are real Postgres rows with the correct total, but
  no money actually moves; the checkout UI is explicit about this.
- **The Refunds legal page describes automation that doesn't exist yet** —
  it states policy, not current implementation; reconcile before relying on
  it for a real dispute.
- **Venue/pitch photography** for seeded venues is stock, not real Lagos
  venues, until each one is actually visited and photographed per the
  verification process `/verification` describes.
