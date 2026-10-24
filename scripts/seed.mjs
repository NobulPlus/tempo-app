/**
 * Push the canonical seed data into a real Supabase project.
 *
 *   npm run seed:staging
 *
 * Requires STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY in
 * .env.staging.local. It deliberately never reads .env.local so it cannot
 * seed the live database by accident.
 * The service role key bypasses row-level security — it is server-only and must
 * never be committed or exposed to the browser.
 *
 * Safe to re-run: everything upserts on a natural key.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* --------------------------------------------------- load .env.local ----- */
if (!process.argv.includes("--staging")) {
  console.error("\n  Refusing to seed without an explicit staging target.\n  Run: npm run seed:staging\n");
  process.exit(1);
}

const envPath = resolve(process.cwd(), ".env.staging.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

if (process.env.TEMPO_ENV !== "staging") {
  console.error("\n  .env.staging.local must include TEMPO_ENV=staging.\n");
  process.exit(1);
}

const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "\n  Missing credentials.\n" +
      "  Add STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY to .env.staging.local\n" +
      "  (Supabase dashboard → Project Settings → API)\n",
  );
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

/* ------------------------------------------------------------- venues ---- */

// Real partner venues only — the earlier fictional placeholder venues
// (Paradise Park Arena, The Yard Lekki, Sabi Sports Centre, Onikan Sports
// Hub, Teslim Balogun Turf, GRA Sports Club, Yaba Tech Turf) were removed
// from staging once real venues existed to replace them; don't re-add them
// here or a future seed run will silently bring the dummy data back.
// Address/phone below are best-effort placeholders pending exact details
// from the signed agreements, not verified contact info.
const VENUES = [
  {
    slug: "astro-ikoyi",
    name: "Astro Ikoyi",
    area: "Ikoyi",
    side: "island",
    address: "Ikoyi, Lagos",
    lat: 6.4531,
    lng: 3.4367,
    phone: "+2348012223344",
    verified: true,
    amenities: ["Floodlights", "Showers", "Parking", "Security", "Changing rooms"],
    description:
      "Nigeria's original 5-a-side ground — built in 2006 as the country's first purpose-made pitch of its kind, and still the benchmark every newer place gets compared to.",
    photos: [`${process.env.STAGING_SUPABASE_URL}/storage/v1/object/public/venue-photos/seed/astro-ikoyi/astro-ikoyi-1.jpg`],
  },
  {
    slug: "upbeat-lekki",
    name: "Upbeat",
    area: "Lekki Phase 1",
    side: "island",
    address: "Admiralty Road, Lekki Phase 1, Lagos",
    lat: 6.4468,
    lng: 3.4699,
    phone: "+2348013334455",
    verified: true,
    amenities: ["Floodlights", "Parking", "Security", "Cafe"],
    description:
      "Part of the Upbeat recreation complex on Admiralty Road — trampoline park and basketball court next door, so it's as much a hangout as a pitch.",
    photos: [`${process.env.STAGING_SUPABASE_URL}/storage/v1/object/public/venue-photos/seed/upbeat-lekki/upbeat-lekki-1.jpg`],
  },
  {
    slug: "playground-lsp",
    name: "Playground LSP",
    area: "Lekki",
    side: "island",
    address: "39 Kusenla Road, Ikate Elegushi, Lekki, Lagos",
    lat: 6.4452,
    lng: 3.4821,
    phone: "+2348014445566",
    verified: true,
    amenities: ["Floodlights", "Parking", "Security"],
    description:
      "Leisure Sports Park — a multi-sport complex off the 4th Roundabout with padel, archery, paintball and basketball alongside the football court. Busy, social, more than just a pitch.",
    photos: [`${process.env.STAGING_SUPABASE_URL}/storage/v1/object/public/venue-photos/seed/playground-lsp/playground-lsp-1.jpg`],
  },
];

const PITCHES = [
  ["astro-ikoyi", "astro-ikoyi-main", "Main Pitch", "5-a-side", "astro", 3_800_000, 1.3],
  ["upbeat-lekki", "upbeat-lekki-pitch", "The Pitch", "5-a-side", "astro", 3_200_000, 1.3],
  ["playground-lsp", "playground-lsp-court", "Football Court", "5-a-side", "concrete", 1_000_000, 1.2],
];

async function main() {
  console.log("\n  Seeding Tempo…\n");

  /* venues */
  const { data: venues, error: vErr } = await sb
    .from("venues")
    .upsert(
      VENUES.map((v) => ({
        ...v,
        verified_at: v.verified ? new Date().toISOString() : null,
        photos: v.photos ?? [],
      })),
      { onConflict: "slug" },
    )
    .select("id, slug, name");

  if (vErr) throw vErr;
  console.log(`  ✓ ${venues.length} venues`);

  const bySlug = Object.fromEntries(venues.map((v) => [v.slug, v.id]));

  /* pitches */
  const { data: pitches, error: pErr } = await sb
    .from("pitches")
    .upsert(
      PITCHES.map(([venueSlug, slug, name, size, surface, price, peak]) => ({
        venue_id: bySlug[venueSlug],
        slug,
        name,
        size,
        surface,
        price_per_hour_kobo: price,
        peak_multiplier: peak,
        floodlights: true,
        covered: surface === "indoor",
        active: true,
      })),
      { onConflict: "slug" },
    )
    .select("id, slug, price_per_hour_kobo, peak_multiplier");

  if (pErr) throw pErr;
  console.log(`  ✓ ${pitches.length} pitches`);

  /* slots — 14 days, 6am to 9pm, with peak pricing */
  const rows = [];
  const now = new Date();

  for (const pitch of pitches) {
    for (let d = 0; d < 14; d++) {
      for (let h = 6; h <= 21; h++) {
        const start = new Date(now);
        start.setDate(start.getDate() + d);
        start.setHours(h, 0, 0, 0);
        if (start <= now) continue;

        const end = new Date(start.getTime() + 3_600_000);
        const dow = start.getDay();
        const peak = dow >= 1 && dow <= 5 && h >= 17 && h <= 20;
        const price = Math.round(
          pitch.price_per_hour_kobo * (peak ? pitch.peak_multiplier : 1),
        );

        rows.push({
          pitch_id: pitch.id,
          during: `[${start.toISOString()},${end.toISOString()})`,
          price_kobo: price,
          status: "open",
        });
      }
    }
  }

  // Insert in chunks; ignore conflicts with slots that already exist.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("slots").insert(chunk);
    if (error && !/exclusion|duplicate/i.test(error.message)) throw error;
    if (!error) inserted += chunk.length;
  }
  console.log(`  ✓ ${inserted} availability slots`);

  console.log(
    "\n  Done. Players, games and ratings are created by real users —\n" +
      "  sign up through the app to make the first one.\n",
  );
}

main().catch((err) => {
  console.error("\n  Seed failed:", err.message ?? err, "\n");
  process.exit(1);
});
