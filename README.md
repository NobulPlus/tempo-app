# Tempo

**Find a pitch, book a pitch, join a game.** Football infrastructure for Lagos.

Built with Next.js 16 (App Router), TypeScript, Tailwind 4 and Supabase.

---

## Run it right now

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. **No keys, no accounts, no setup.**

The app boots in **demo mode** — seeded Lagos venues, real availability, working
booking and join flows, all held in memory. Sign in as any seeded player from the
login page to see the product as a player, a host, or a venue owner. Folake Johnson
owns two venues; Chidi, Amina, Tunde and Yemi host games.

When you're ready for a real database, see [Going live](#going-live) or open
`/setup` in the running app.

---

## What's here

```
src/
  app/
    page.tsx                    Landing — honest stats, live "kicking off soon" rail
    pitches/                    Discovery, filters, real distance sorting
    pitches/[slug]/             Pitch detail + availability calendar
    pitches/[slug]/book/        Checkout — card, transfer, USSD
    bookings/[reference]/       Confirmation with leave-by time and WhatsApp share
    games/                      Open games with live fill state
    games/[slug]/               Game detail, roster, waitlist, join/leave
    host/                       Create a game with pricing guidance
    venue/                      Venue dashboard — utilisation and revenue
    players/                    Community, leaderboards
    players/[handle]/           Player card with peer-voted traits
    dashboard/                  My games, bookings, reputation
    legal/                      Terms, Privacy (NDPA), Refunds, Community Rules
    actions.ts                  All server actions
  components/
    match/                      Countdown, FillBar, SpotPips, HeatPill, GameCard
    player/                     PlayerCard, TraitRadar, StreakBadge, PunctualityRing
    pitch/                      PitchCard, SlotPicker, filters
  lib/
    types.ts                    Domain model
    match.ts                    Match state engine + Lagos traffic estimates
    format.ts                   Money (kobo), WAT times, distance, phone
    data/repo.ts                Single data access layer — swap backend here
    data/seed.ts                Canonical seed data
supabase/
  migrations/0001_init.sql      Schema, RLS, triggers, constraints
scripts/seed.mjs                Push seed data to a real Supabase project
```

---

## Design decisions worth knowing

**Money is integer kobo, everywhere.** Never floats, never strings. `formatNaira()`
is the only thing that turns it into text.

**Double-booking is impossible at the database level.** `slots` carries a GiST
exclusion constraint on `(pitch_id, during)` — two overlapping slots on the same
pitch cannot exist. Application-level checks lose the race under concurrency;
constraints don't.

**Joining a game is atomic.** `join_game()` locks the game row, counts confirmed
players inside the transaction, and either confirms you or puts you on the
waitlist. Two people tapping Join simultaneously can never both take the last spot.

**Reputation is derived, never declared.** Punctuality starts at 100 and drops 12
per no-show and 1 per 5 minutes late. Traits move only on teammate votes. Streaks
count consecutive ISO weeks with a game played. All maintained by Postgres
triggers, so a client cannot write its own rating.

**Row-level security is default-deny.** Every table is locked, then opened
deliberately. Payments are readable only by their owner. You can only rate someone
who played the same game as you, after it finished.

**Match state has one source of truth.** `getMatchState()` derives the label,
colour, heat and CTA from real numbers, so the badge can never disagree with the
roster.

**The data layer is one file.** Pages never touch Supabase directly — they call
`lib/data/repo.ts`. Demo mode and Postgres are two branches in one place.

---

## Going live

1. **Create a Supabase project** — pick `eu-west-1` (Ireland), the lowest-latency
   region for Nigerian traffic.
2. **Run the migration** — paste `supabase/migrations/0001_init.sql` into the SQL
   Editor and run it.
3. **Add keys** — copy `.env.example` to `.env.local`, fill in the Supabase URL and
   anon key. Restart. The demo banner disappears.
4. **Seed** — `npm run seed` (needs `SUPABASE_SERVICE_ROLE_KEY`).
5. **Payments** — add Paystack keys. Checkout, the `payments` table and the refund
   rules are built; what remains is calling Paystack's initialise endpoint and
   handling the webhook.
6. **Deploy** — push to GitHub, import in Vercel, add the same env vars, set
   `NEXT_PUBLIC_SITE_URL`.

---

## Before your first real booking

- [ ] Read Terms, Privacy and Refunds and make every sentence true for you
- [ ] Put real inboxes behind `hello@` `help@` `safety@` `privacy@`
- [ ] Visit and photograph every venue marked verified — the site claims you did
- [ ] Decide who holds money between booking and kickoff, and write it down
- [ ] Register with the Nigeria Data Protection Commission if required for your scale

---

## Commands

```bash
npm run dev          # demo mode, no setup needed
npm run build        # production build
npm run start        # serve the build
npm run type-check   # tsc --noEmit
npm run lint         # eslint
npm run seed         # push seed data to Supabase
```
