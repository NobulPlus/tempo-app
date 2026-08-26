# Tempo

**Find a pitch, book a pitch, join a game.** Football infrastructure for
Lagos, Nigeria.

Tempo solves three real, specific problems for recreational football in
Lagos: finding a verified place to play, booking it without a phone call and
a "the pitch is actually double-booked" surprise, and joining a pickup game
with people who reliably show up. It is not a generic sports-booking clone —
every product decision below (traffic-aware "leave by" times, the
Island/Mainland geography split, kobo-denominated pricing, punctuality as a
tracked number) exists because it's what organising football in Lagos
specifically requires.

This repository currently has **two branches with two different jobs**:

| Branch | What it is | Status |
|---|---|---|
| `master` | The real product — Next.js App Router + Supabase Postgres, demo mode by default | Working, not yet deployed |
| `v2` (this branch) | A frontend-only visual/design-system redesign — no backend, no database | New pages built, older ones still on v1 styling |

Everything below covers both: the product as designed on `master`, and what
`v2` changes.

---

## Contents

1. [Product overview](#product-overview)
2. [Tech stack](#tech-stack)
3. [Domain model](#domain-model)
4. [How `master` (v1) is architected](#how-master-v1-is-architected)
5. [The Postgres schema](#the-postgres-schema)
6. [Business logic worth knowing](#business-logic-worth-knowing)
7. [v2 — the design-system branch](#v2--the-design-system-branch)
8. [v2 design system in detail](#v2-design-system-in-detail)
9. [v2 mock data](#v2-mock-data)
10. [What's real vs. mocked vs. placeholder in v2](#whats-real-vs-mocked-vs-placeholder-in-v2)
11. [Full page inventory](#full-page-inventory)
12. [Hosting & going live](#hosting--going-live)
13. [Running the project](#running-the-project)
14. [Known limitations / open follow-ups](#known-limitations--open-follow-ups)

---

## Product overview

**Who it's for:** recreational and semi-serious footballers in Lagos who
currently organise games over WhatsApp and phone calls — plus the venue
owners renting out pitches and the hosts running weekly games.

**The three core flows:**
- **Find & book a pitch** — browse verified venues, real availability, pay by
  card/transfer/USSD, get a confirmation with a WhatsApp-shareable reference
  and a traffic-aware "leave by" time.
- **Join an open game** — browse games that need players, see exactly how
  many spots are left and whether the game is "guaranteed" to go ahead, join
  solo, get waitlisted automatically if it's full.
- **Host a game** — pick a pitch and slot, set a capacity and a minimum
  headcount to guarantee it, get pricing guidance, watch it fill live.

Supporting flows: a venue-owner dashboard (utilisation, revenue), a player
reputation system (see below), and a public player profile/card.

---

## Tech stack

- **Next.js 16** (App Router, React Server Components + Server Actions)
- **TypeScript**, strict
- **Tailwind CSS 4** (CSS-first `@theme` configuration, no `tailwind.config.js`)
- **Supabase** (Postgres, Auth, Row-Level Security) — `master` only
- **Zod** for input validation on server actions
- **date-fns** for date arithmetic
- No component library, no CSS-in-JS, no state-management library — deliberately.
  Server Components fetch data directly; client interactivity is `useState`/
  `useActionState` and a handful of small hooks.

---

## Domain model

Defined once in `src/lib/types.ts`, mirrored exactly by the Postgres schema
on `master` (comment in the file literally says so). The core entities:

- **`Venue`** — a physical location: name, area (e.g. "Lekki Phase 1"), a
  Lagos-specific `side: "island" | "mainland"`, lat/lng, amenities, photos,
  and a `verified`/`verifiedAt` pair (verification is a public claim, so it
  carries a timestamp).
- **`Pitch`** — one bookable surface at a venue: size (`5-a-side` /
  `7-a-side` / `11-a-side`), surface (`astro` / `grass` / `indoor` /
  `concrete`), floodlights/covered flags, `pricePerHourKobo` and a
  `peakMultiplier` for evening pricing.
- **`Slot`** — one bookable hour on one pitch, with a status
  (`open`/`held`/`booked`/`blocked`).
- **`Booking`** — a paid reservation of a slot: reference code, status,
  amounts in kobo, payment method.
- **`Game`** — an open pickup game hosted on a pitch at a specific time:
  capacity, `minimumToGuarantee` (how many players must join before it's
  locked in), `pricePerPlayerKobo`, skill `level`.
- **`GameParticipant`** — a player's membership in a game:
  `confirmed`/`waitlist`/`withdrawn`/`no_show`/`played`.
- **`PlayerProfile`** — handle, position, foot, bio, role
  (`player`/`host`/`venue_owner`), and the entire reputation block below.
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

## How `master` (v1) is architected

There is no separate backend API. The "backend" is Postgres plus a thin
Next.js layer:

- **Server Components fetch data directly** during render — no client-side
  data-fetching library, no REST/GraphQL layer.
- **Server Actions** (`src/app/actions.ts`, `"use server"`) handle every
  mutation: joining a game, creating a booking, hosting a game, signing up.
  Client Components call them like local functions; Zod validates input;
  `revalidatePath()` refreshes the affected routes afterward.
- **`src/lib/data/repo.ts` is the single data-access layer.** Every page and
  action goes through it — never straight to Supabase. Internally it
  branches on `demoMode()`: with no Supabase credentials configured, it reads
  and writes an in-memory store (`lib/data/store.ts`, seeded from
  `lib/data/seed.ts`); with credentials present, it queries Postgres. Pages
  don't know or care which mode they're in. That's *why* `npm run dev` works
  with zero setup out of the box.
- **Auth** (`src/lib/session.ts`) follows the same pattern: a real Supabase
  session via `sb.auth.getUser()`, or in demo mode a cookie
  (`tempo_demo_user`) holding a seeded profile ID, so you can sign in as any
  seeded player, host, or venue owner without a backend.
- **`src/lib/supabase/{server,client}.ts`** wrap `@supabase/ssr`'s
  cookie-aware client creation for Server Components/Actions and Client
  Components respectively.

The one thing this architecture can't do itself: anything an **external**
service needs to call, like a Paystack payment webhook. Server Actions are
only invocable from within the app, so that's a plain Next.js Route Handler
— not built yet, called out explicitly in "Known limitations" below.

---

## The Postgres schema

`supabase/migrations/0001_init.sql` — the schema is where a lot of Tempo's
actual correctness guarantees live, not in application code:

- **Money is `bigint` kobo** everywhere, matching the TypeScript types exactly.
- **Double-booking is prevented at the database level.** `slots` carries a
  GiST exclusion constraint (`using btree_gist`) on `(pitch_id, during)` —
  two overlapping slots on the same pitch cannot exist, full stop. An
  application-level "check then insert" loses this race under concurrent
  requests; a database constraint cannot.
- **Joining a game is atomic.** A `join_game()` Postgres function locks the
  game row, counts confirmed players inside that transaction, and either
  confirms the caller or waitlists them — so two people tapping "Join"
  simultaneously can never both take the last spot.
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
  owns everything else about a person.

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

---

## v2 — the design-system branch

`v2` exists to answer one question before more product engineering happens:
**what should Tempo actually look and feel like?** It is deliberately
**frontend-only** — no Supabase, no server actions doing real writes, no
persistence. Every v2 page reads from a hand-written mock data module
instead of `lib/data/repo.ts`, and interactive flows (joining a game,
submitting the waitlist form) are local component state that resets on
refresh. `master` is untouched.

### Design direction: "Matchday, not SaaS dashboard"

v1's look — dark navy background, neon green/orange/purple/blue radial
gradients, glass-blurred cards, pill buttons everywhere — reads as a generic
"AI dark-theme SaaS" aesthetic, not something specific to Lagos football or
to Tempo. v2 replaces the *execution* while keeping what already worked: the
pitch-green brand hue, the dark/floodlit mood, and the match-heat urgency
system, which is real product logic and stayed untouched.

The new direction is grounded in three concrete references (screenshots
reviewed directly, not guessed from descriptions):

- **[Footy Addicts](https://footyaddicts.com)** — dark, editorial, real
  match photography in the hero; bold stat callouts as social proof ("289K+
  registered players"); loose hand-drawn doodle icons for the "how it works"
  steps; a playful handwritten accent font mixed into a bold sans headline;
  testimonial cards with a quote-bubble icon, star rating, and avatar; a
  large area/city-based link footer.
- **[Playtomic](https://playtomic.com)** — confident full-bleed
  colour-blocked sections; numbered circular step badges (1 Find, 2 Book, 3
  Join); clean photo-top cards with pill CTAs; a two-tone accent system.
- **Tempo v1 itself** — the green brand colour (already grass/pitch-
  appropriate, no reason to abandon it), the live countdown/fill-bar
  mechanics, the cold/warm/hot/full heat semantics.

---

## v2 design system in detail

The living, interactive version of everything below is at **`/system`** —
run the app and open it. That page is the actual deliverable this branch was
built to produce, separate from the product pages themselves.

### Colour

Dark-first (two of the three references are dark, and it suits a floodlit
night-match mood), with a genuine light mode added on top — **v1 had no
light mode at all**, hard-coded to one dark palette.

| Token | Dark value | Role |
|---|---|---|
| `--color-bg-primary` | `#0b0f0c` | Base background |
| `--color-bg-secondary` | `#0f2318` | Alternating full-bleed section band |
| `--color-bg-card` | `#141a15` | Card surface |
| `--color-ink` / `--color-ink-soft` / `--color-ink-muted` | `#f3f6f1` / `#b7c2b4` / `#8b978a` | Text, WCAG-AA checked |
| `--color-green` / `--color-green-deep` | `#17b95c` / `#0e8a44` | Brand accent — deepened from v1's neon `#00e676` into something closer to a kit/jersey green |
| `--color-gold` | `#f5a623` | "Floodlight" — the match-heat *warm* state |
| `--color-orange` | `#ff5a45` | Coral — the match-heat *hot* state, also a nod to Footy Addicts' red without copying its hue |
| `--color-blue` / `--color-purple` | `#4c8dff` / `#a78bfa` | *Cold*/casual and competitive-level tags respectively |

Light mode redefines the same token set (`#f5f4ee` background, `#11201a`
ink, etc.) under `prefers-color-scheme: light` — every component reads from
tokens, never a hard-coded colour, so the whole app repaints correctly.

### Typography

Four faces, each with one job, loaded via `next/font/google` (self-hosted,
no layout shift):

- **Bricolage Grotesque** (display) — headlines and the big stat callouts,
  chosen for its bold, distinctive character over the "safe" Inter/Space
  Grotesk defaults.
- **Figtree** (body) — everything you actually read.
- **Caveat** (accent) — a handwritten script used *sparingly*, only for
  taglines/emphasis, mirroring Footy Addicts' own marker-script accent.
- **JetBrains Mono** (data) — prices, countdowns, fill fractions — anywhere
  digits need to line up, with `tabular-nums`.

### Layout & components

- Alternating full-bleed colour-blocked section bands instead of one flat
  background.
- **`src/components/ui/`** — the typed component-primitive layer v1 never
  had: `Button` (primary/ghost/outline variants), `Card` (hover/accent/
  spokes-overlay flags), `Badge`, `Field`/`SelectField`/`TextAreaField`,
  `StepBadge` (Playtomic-style numbered circles), `TestimonialCard`
  (quote-bubble + stars + avatar). v1 instead hand-applied CSS utility
  classnames (`.card-t`, `.btn-t`) on every page individually.
- **Icons** stay hand-rolled inline SVG (`components/icons.tsx`, ~30 icons,
  one component each, no library) — a good pattern, kept as-is — plus a new
  second tier of deliberately looser "doodle" icons (`DoodleFindIcon`,
  `DoodleBookIcon`, `DoodlePlayIcon`) reserved only for the "how it works"
  storytelling section, matching the Footy Addicts split between precise
  functional icons and playful illustration.
- **Footer** gained an area-based link block ("Play football in Lekki /
  Ikoyi / …"), generated from the real distinct areas in the mock venue
  data — a direct structural borrow from Footy Addicts' city-footer pattern,
  and a natural fit since Tempo already models Lagos "areas" as data.
- **Hero video**: a looping, muted, license-free soccer clip (sourced from
  Mixkit, no attribution required — verified by downloading and visually
  inspecting the actual footage before using it, since stock-site "football"
  categories are ambiguous between soccer and American football) replaces
  v1's static radial-gradient background. `prefers-reduced-motion` swaps it
  for a static frame via pure CSS (`motion-safe:`/`motion-reduce:`), no JS.

---

## v2 mock data

`src/lib/mock/` is v2's entire data layer — fresh content, decoupled from
`lib/data/seed.ts`, but typed against the same `lib/types.ts` interfaces
(the types are contracts, not backend, so reusing them was safe).

- **8 venues** across Lekki Phase 1, Victoria Island, Ikoyi, Lagos Island,
  Yaba, Ikeja GRA, Gbagada, and Surulere — e.g. The Pitch House, Marina Turf
  Club, Bourdillon Arena, Freedom Park Kickabout.
- **9 pitches** spread across those venues, 5-a-side through 11-a-side,
  astro/grass/indoor/concrete surfaces.
- **9 players** with full reputation blocks (punctuality, streaks, MOTM
  counts, peer ratings, six-trait radars).
- **6 open games**, one per venue, spanning casual/intermediate/competitive
  levels and today-through-five-days-out kickoff times (computed relative to
  "now," so the demo never looks stale).
- **3 testimonials** for the landing page's reviews section.

`src/lib/mock/index.ts` exposes the **same function names** v1's
`lib/data/repo.ts` does — `listPitches`, `getGameBySlug`, `getPlatformStats`,
`getUrgentGames`, etc. — as plain synchronous array lookups with no
`server-only` restriction, so v2 pages read almost identically to their v1
equivalents; only the import path changed.

Reused **unchanged** from v1 because they're pure functions with zero
backend dependency: `lib/match.ts` and `lib/format.ts`.

---

## What's real vs. mocked vs. placeholder in v2

- **Real, unchanged product logic:** money handling, `getMatchState()`
  derivation, the reputation numbers shown on player cards.
- **Mocked because there's no backend:** joining/leaving a game is local
  `useState` — optimistic, not persisted, resets on refresh. No
  double-booking constraint, no atomic join, no RLS — those are real
  guarantees in v1's Postgres schema and are out of scope for this branch.
- **Placeholder, meant to be swapped later:** venue/pitch photography is
  generic Picsum stock (not football-specific — a known, called-out
  limitation, not a bug).

---

## Full page inventory

**Rebuilt on the v2 design system:**

| Route | What it is |
|---|---|
| `/` | Landing — video hero, honest live stats, numbered "Find/Book/Play" steps, feature grid, top pitches, testimonials, area-based footer |
| `/pitches` | Discovery — search, area/size filters, sort by near/cheap/rated |
| `/pitches/[slug]` | Pitch detail — venue info, amenities, games happening there |
| `/games` | Open games — search, level/when/side filters |
| `/games/[slug]` | Game detail — live fill bar, countdown, roster + waitlist, join button, "when to leave," host card |
| `/players/[handle]` | Player card — trait radar, punctuality ring, streak, upcoming games |
| `/dashboard` | My games (joined/hosting), reputation strip, streak nudge |
| `/system` | The design-system style guide |

**Still on v1 styling, still calling `lib/data/repo.ts`/`actions.ts` (not yet
touched by v2 — a deliberate, scoped-down first pass, not a bug):**

`/pitches/[slug]/book` (checkout), `/host`, `/login`, `/signup`,
`/bookings/[reference]`, `/venue` (owner dashboard), `/players` (directory),
`/legal/{terms,privacy,refunds,community}`, `/setup`.

---

## Hosting & going live

Decided for the real product (`master`), not applicable to `v2` as it
stands since this branch has no backend to host:

- **App:** Vercel — zero-config for Next.js App Router + Server Actions,
  which v1 uses throughout.
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
  after 7 days idle); **~$45/mo** at launch (Vercel Pro $20/seat + Supabase
  Pro $25); no published self-serve annual discount on either platform as of
  this writing.
- **Still open before a real launch:** Paystack integration (the `payments`
  table and checkout UI exist; the initialise call and webhook handler
  don't), a Route Handler for that webhook specifically since Server Actions
  can't be invoked by an external service, and everything on the
  "Before your first real booking" checklist below.

### Before the first real booking

- [ ] Read Terms, Privacy and Refunds and make every sentence true for you
- [ ] Put real inboxes behind `hello@` `help@` `safety@` `privacy@`
- [ ] Visit and photograph every venue marked verified — the site claims you did
- [ ] Decide who holds money between booking and kickoff, and write it down
- [ ] Register with the Nigeria Data Protection Commission if required for your scale

---

## Running the project

```bash
npm install
npm run dev          # demo mode (master) or mock mode (v2) — no setup needed either way
npm run build         # production build
npm run start         # serve the build
npm run type-check    # tsc --noEmit
npm run lint           # eslint
npm run seed           # master only — push seed data to a real Supabase project
```

Open <http://localhost:3000>. No keys, no accounts required on either
branch. On `master`, sign in as any seeded player from the login page to
experience the product as a player, a host, or a venue owner — Folake
Johnson owns two venues; Chidi, Amina, Tunde and Yemi host games. On `v2`
there's no sign-in at all; the nav always shows the first mock player as
"you."

When `master` is ready for a real database: create a Supabase project in
`eu-west-1` (lowest-latency region for Nigerian traffic in the absence of an
African Supabase region), run `supabase/migrations/0001_init.sql`, copy
`.env.example` to `.env.local` with the project URL and anon key, then
`npm run seed` (needs `SUPABASE_SERVICE_ROLE_KEY`).

---

## Known limitations / open follow-ups

- **`v2`:** booking/checkout, hosting, auth, venue dashboard, players
  directory and legal pages haven't been restyled yet (Phase C, deferred by
  design so the flagship pages could be reviewed first); venue/pitch photos
  are generic stock, not real Lagos venues.
- **`master`:** Paystack isn't wired up yet (initialise call + webhook
  handler both outstanding); no production deployment exists yet; the
  "Before the first real booking" checklist above is entirely unchecked.
