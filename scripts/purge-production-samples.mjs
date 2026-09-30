/**
 * Audits or removes Tempo's known sample venues from production.
 *
 * npm run audit:production-samples
 * npm run purge:production-samples -- --confirm=REMOVE_TEMPO_SAMPLE_DATA
 *
 * This deliberately reads only .env.production.local. It refuses to purge a
 * sample venue once real activity is attached, protecting genuine customers
 * and financial records from a broad cleanup.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_SLUGS = [
  "paradise-park-arena", "the-yard-lekki", "sabi-sports-centre",
  "onikan-sports-hub", "teslim-balogun-turf", "gra-sports-club", "yaba-tech-turf",
];
const purging = process.argv.includes("--purge");
const confirmed = process.argv.includes("--confirm=REMOVE_TEMPO_SAMPLE_DATA");

loadEnv(resolve(process.cwd(), ".env.production.local"));
if (process.env.TEMPO_ENV !== "production") fail(".env.production.local must include TEMPO_ENV=production.");
if (purging && !confirmed) fail("Add --confirm=REMOVE_TEMPO_SAMPLE_DATA to perform the production purge.");

const url = process.env.PRODUCTION_SUPABASE_URL;
const key = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("Add PRODUCTION_SUPABASE_URL and PRODUCTION_SUPABASE_SERVICE_ROLE_KEY to .env.production.local.");

const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: venues, error } = await sb.from("venues").select("id, name, slug").in("slug", SAMPLE_SLUGS);
if (error) fail(error.message);
if (!venues?.length) {
  console.log("No known Tempo sample venues were found.");
  process.exit(0);
}

const venueIds = venues.map((venue) => venue.id);
const { data: pitches, error: pitchError } = await sb.from("pitches").select("id").in("venue_id", venueIds);
if (pitchError) fail(pitchError.message);
const pitchIds = (pitches ?? []).map((pitch) => pitch.id);
let bookings = 0;
if (pitchIds.length) {
  const { data: slots, error: slotError } = await sb.from("slots").select("id").in("pitch_id", pitchIds);
  if (slotError) fail(slotError.message);
  const slotIds = (slots ?? []).map((slot) => slot.id);
  if (slotIds.length) {
    const { count, error: bookingError } = await sb.from("bookings").select("id", { count: "exact", head: true }).in("slot_id", slotIds);
    if (bookingError) fail(bookingError.message);
    bookings = count ?? 0;
  }
}
const [{ count: games, error: gameError }, { count: settlements, error: settlementError }] = await Promise.all([
  pitchIds.length ? sb.from("games").select("id", { count: "exact", head: true }).in("pitch_id", pitchIds) : Promise.resolve({ count: 0, error: null }),
  sb.from("venue_settlements").select("id", { count: "exact", head: true }).in("venue_id", venueIds),
]);
if (gameError) fail(gameError.message);
if (settlementError) fail(settlementError.message);

console.log(`Found ${venues.length} sample venue(s):`);
for (const venue of venues) console.log(`  - ${venue.name} (${venue.slug})`);
console.log(`Attached records: ${bookings} bookings, ${games ?? 0} games, ${settlements ?? 0} settlements.`);

if (!purging) {
  console.log("Audit only. No data was changed.");
  process.exit(0);
}
if (bookings + (games ?? 0) + (settlements ?? 0) > 0) {
  fail("Refusing to delete sample venues with attached operational or financial records. Review these records manually first.");
}

const { error: deleteError } = await sb.from("venues").delete().in("id", venueIds);
if (deleteError) fail(deleteError.message);
console.log(`Removed ${venues.length} sample venue(s) and their empty resources/slots.`);

function loadEnv(path) {
  if (!existsSync(path)) fail(`Missing ${path}.`);
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}
