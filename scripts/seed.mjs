/**
 * Push the canonical seed data into a real Supabase project.
 *
 *   npm run seed
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The service role key bypasses row-level security — it is server-only and must
 * never be committed or exposed to the browser.
 *
 * Safe to re-run: everything upserts on a natural key.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* --------------------------------------------------- load .env.local ----- */
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "\n  Missing credentials.\n" +
      "  Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local\n" +
      "  (Supabase dashboard → Project Settings → API)\n",
  );
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

/* ------------------------------------------------------------- venues ---- */

const VENUES = [
  {
    slug: "paradise-park-arena",
    name: "Paradise Park Arena",
    area: "Ikoyi",
    side: "island",
    address: "12 Glover Road, Ikoyi, Lagos",
    lat: 6.4541,
    lng: 3.4348,
    phone: "+2348031234567",
    verified: true,
    amenities: ["Floodlights", "Showers", "Parking", "Security", "First aid", "Bibs"],
    description:
      "Two full-size astro pitches behind the old tennis club. Gated, well lit, and the only place in Ikoyi where you can reliably get a game after 9pm.",
  },
  {
    slug: "the-yard-lekki",
    name: "The Yard, Lekki",
    area: "Lekki Phase 1",
    side: "island",
    address: "Admiralty Way, Lekki Phase 1, Lagos",
    lat: 6.4478,
    lng: 3.4723,
    phone: "+2348027654321",
    verified: true,
    amenities: ["Floodlights", "Showers", "Parking", "Security", "Cafe"],
    description:
      "The busiest five-a-side spot on the Island. Three courts, floodlit until midnight.",
  },
  {
    slug: "sabi-sports-centre",
    name: "Sabi Sports Centre",
    area: "Victoria Island",
    side: "island",
    address: "Ozumba Mbadiwe Avenue, Victoria Island, Lagos",
    lat: 6.4281,
    lng: 3.4219,
    phone: "+2348039876543",
    verified: true,
    amenities: ["Floodlights", "Showers", "Parking", "Air conditioning", "Security"],
    description:
      "Indoor, air-conditioned, and the only pitch in Lagos where the rain is somebody else's problem.",
  },
  {
    slug: "onikan-sports-hub",
    name: "Onikan Sports Hub",
    area: "Onikan",
    side: "island",
    address: "Cathedral Street, Onikan, Lagos Island",
    lat: 6.4433,
    lng: 3.4064,
    phone: "+2348051112233",
    verified: true,
    amenities: ["Floodlights", "Parking", "Security", "Changing rooms"],
    description: "Old-school Lagos Island ground, resurfaced in 2025.",
  },
  {
    slug: "teslim-balogun-turf",
    name: "Teslim Balogun Turf",
    area: "Surulere",
    side: "mainland",
    address: "Teslim Balogun Stadium complex, Surulere, Lagos",
    lat: 6.4969,
    lng: 3.3481,
    phone: "+2348064445566",
    verified: true,
    amenities: ["Floodlights", "Showers", "Parking", "Security", "Stands", "First aid"],
    description:
      "Full eleven-a-side natural grass inside the stadium complex. Proper football, proper dugouts.",
  },
  {
    slug: "gra-sports-club",
    name: "GRA Sports Club",
    area: "Ikeja GRA",
    side: "mainland",
    address: "Isaac John Street, Ikeja GRA, Lagos",
    lat: 6.5833,
    lng: 3.35,
    phone: "+2348077778899",
    verified: true,
    amenities: ["Floodlights", "Parking", "Bar", "Security"],
    description: "Members' club with the best surface north of the bridge.",
  },
  {
    slug: "yaba-tech-turf",
    name: "Yaba Tech Turf",
    area: "Yaba",
    side: "mainland",
    address: "Herbert Macaulay Way, Yaba, Lagos",
    lat: 6.5095,
    lng: 3.3711,
    phone: "+2348090001122",
    verified: false,
    amenities: ["Floodlights", "Parking"],
    description: "Student-run pitch beside the polytechnic. Cheapest game in Lagos.",
  },
];

const PITCHES = [
  ["paradise-park-arena", "paradise-park-arena-pitch-a", "Pitch A", "7-a-side", "astro", 4_000_000, 1.3],
  ["paradise-park-arena", "paradise-park-arena-pitch-b", "Pitch B", "5-a-side", "astro", 3_000_000, 1.3],
  ["the-yard-lekki", "the-yard-lekki-court-1", "Court 1", "5-a-side", "astro", 3_000_000, 1.4],
  ["the-yard-lekki", "the-yard-lekki-court-2", "Court 2", "7-a-side", "astro", 3_800_000, 1.4],
  ["sabi-sports-centre", "sabi-sports-centre-indoor", "Indoor Arena", "5-a-side", "indoor", 4_500_000, 1.25],
  ["onikan-sports-hub", "onikan-sports-hub-main", "Main Pitch", "7-a-side", "astro", 2_200_000, 1.2],
  ["teslim-balogun-turf", "teslim-balogun-turf-main", "Main Bowl", "11-a-side", "grass", 5_000_000, 1.5],
  ["gra-sports-club", "gra-sports-club-turf", "Club Turf", "7-a-side", "astro", 2_800_000, 1.2],
  ["yaba-tech-turf", "yaba-tech-turf-main", "The Turf", "5-a-side", "concrete", 1_200_000, 1.1],
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
        photos: [],
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
