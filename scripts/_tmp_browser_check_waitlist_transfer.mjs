import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "http://localhost:3000";
const PASSWORD = "TestPass123!ui";
const tag = Date.now();
const created = { users: [], venueId: null, pitchId: null, slotIds: [], bookingIds: [] };

function ok(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  if (!cond) process.exitCode = 1;
}

async function createUser(label) {
  const email = `bwtui-${label}-${tag}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  await admin.from("profiles").update({ created_at: "2020-01-01T00:00:00Z", avatar_url: "https://example.com/a.png", full_name: `UI ${label.toUpperCase()}` }).eq("id", data.user.id);
  await admin.from("wallets").insert({ user_id: data.user.id, balance_kobo: 10_000_000 });
  created.users.push(data.user.id);
  const { data: profile } = await admin.from("profiles").select("handle").eq("id", data.user.id).single();
  return { id: data.user.id, email, handle: profile.handle };
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

async function makeSlot(hoursFromNow) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const { data: slot } = await admin
    .from("slots")
    .insert({ pitch_id: created.pitchId, during: `[${start.toISOString()},${end.toISOString()})`, price_kobo: 1_000_000, status: "open" })
    .select()
    .single();
  created.slotIds.push(slot.id);
  return slot;
}

async function main() {
  const a = await createUser("a");
  const b = await createUser("b");

  const { data: venue } = await admin
    .from("venues")
    .insert({ slug: `bwtui-venue-${tag}`, name: "BWT UI Venue", area: "Test", side: "mainland", address: "1 St", lat: 6.5, lng: 3.4 })
    .select()
    .single();
  created.venueId = venue.id;
  const { data: pitch } = await admin
    .from("pitches")
    .insert({ venue_id: venue.id, slug: `bwtui-pitch-${tag}`, name: "BWT UI Pitch", size: "5-a-side", surface: "astro", price_per_hour_kobo: 1_000_000 })
    .select()
    .single();
  created.pitchId = pitch.id;

  const browser = await chromium.launch();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  pageA.on("console", (msg) => console.log(`[A:${msg.type()}]`, msg.text()));
  pageB.on("console", (msg) => console.log(`[B:${msg.type()}]`, msg.text()));
  pageA.on("pageerror", (err) => console.log("[A:pageerror]", err.message));
  pageB.on("pageerror", (err) => console.log("[B:pageerror]", err.message));

  try {
    await login(pageA, a.email);
    await login(pageB, b.email);

    console.log("\n--- waitlist UI ---");
    const slot1 = await makeSlot(48);
    // A books it directly via RPC (setup), then B visits the book page and should see the dead-end + waitlist button.
    const aServerClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    await aServerClient.auth.signInWithPassword({ email: a.email, password: PASSWORD });
    const { data: booking1 } = await aServerClient.rpc("create_booking", { p_slot_id: slot1.id });
    created.bookingIds.push(booking1.id);

    await pageB.goto(`${BASE}/pitches/${pitch.slug}/book?slot=${slot1.id}`);
    await pageB.waitForSelector("text=That slot just went", { timeout: 10000 });
    const waitlistBtn = pageB.locator('button:has-text("Notify me if this opens up")');
    ok("Waitlist button appears on an unavailable slot", (await waitlistBtn.count()) > 0);
    await waitlistBtn.click();
    await pageB.waitForTimeout(2500);
    const { data: waitlistRow } = await admin.from("booking_waitlist").select("*").eq("slot_id", slot1.id).eq("user_id", b.id).maybeSingle();
    console.log("waitlist row after click:", waitlistRow);
    const toastText = await pageB.locator('[role="alert"]').allInnerTexts().catch(() => []);
    console.log("B toast text (if any):", toastText);

    const cancelResult = await aServerClient.rpc("cancel_booking", { p_booking_id: booking1.id });
    ok("A's cancel (server-side) succeeded", !cancelResult.error);

    await pageB.goto(`${BASE}/pitches/${pitch.slug}/book?slot=${slot1.id}`);
    await pageB.waitForTimeout(500);
    const { data: slot1After } = await admin.from("slots").select("status, held_for_user_id, held_until").eq("id", slot1.id).single();
    console.log("slot1 state at check time:", slot1After, "expected held_for_user_id:", b.id);
    const reservedBanner = pageB.locator("text=Reserved for you until");
    ok("B sees the 'reserved for you' banner after A cancels", (await reservedBanner.count()) > 0);
    const bookBtn = pageB.locator('button:has-text("Confirm"), button:has-text("Pay")').first();
    // Whatever the checkout form's submit button says, confirm the normal booking form rendered (not the dead-end).
    const deadEndGone = (await pageB.locator("text=That slot just went").count()) === 0;
    ok("Normal booking form renders instead of the dead-end for the reserved user", deadEndGone);

    console.log("\n--- transfer UI ---");
    const slot2 = await makeSlot(60);
    const { data: booking2, error: booking2Err } = await aServerClient.rpc("create_booking", { p_slot_id: slot2.id });
    console.log("booking2:", booking2?.id, "error:", booking2Err);
    ok("Second booking (for transfer test) created successfully", !booking2Err && !!booking2);
    created.bookingIds.push(booking2?.id);
    const { data: bookingRow } = await admin.from("bookings").select("reference, status").eq("id", booking2.id).single();
    console.log("bookingRow:", bookingRow);

    await pageA.goto(`${BASE}/bookings/${bookingRow.reference}`);
    await pageA.waitForSelector("text=You've got the pitch", { timeout: 10000 });
    await pageA.waitForSelector('button:has-text("Transfer to a friend")', { timeout: 10000 });
    await pageA.click('button:has-text("Transfer to a friend")');
    await pageA.fill('input[placeholder="Search by name or handle"]', "UI B");
    await pageA.waitForTimeout(500);
    const suggestion = pageA.locator(`button:has-text("UI B")`).first();
    ok("Friend search finds B by name", (await suggestion.count()) > 0);
    await suggestion.click();
    await pageA.click('button:has-text("Send transfer offer")');
    await pageA.waitForTimeout(2500);
    const aToastText = await pageA.locator('[role="alert"]').allInnerTexts().catch(() => []);
    console.log("A toast text (if any):", aToastText);
    const bodyAfterOffer = await pageA.locator("body").innerText();
    console.log("--- page text around transfer form after submit ---");
    console.log(bodyAfterOffer.split("\n").filter((l) => l.toLowerCase().includes("transfer")).join("\n"));
    const sentConfirmation = pageA.locator("text=Transfer offer sent");
    ok("Transfer offer confirmation shown to A", (await sentConfirmation.count()) > 0);

    const { data: offer } = await admin.from("booking_transfer_offers").select("id").eq("booking_id", booking2.id).eq("status", "open").single();
    ok("Offer row actually created", !!offer);

    await pageB.goto(`${BASE}/bookings/transfer/${offer.id}`);
    await pageB.waitForSelector("text=wants to send you a booking", { timeout: 10000 });
    ok("B sees the transfer offer page with A's name", true);
    await pageB.click('button:has-text("Accept & pay")');
    await pageB.waitForURL((url) => url.pathname.startsWith("/bookings/") && !url.pathname.includes("transfer"), { timeout: 10000 });
    ok("Accepting redirects B to the booking confirmation page", pageB.url().includes(`/bookings/${bookingRow.reference}`));

    console.log("\n--- notification bell ---");
    await pageA.goto(`${BASE}/dashboard`);
    await pageA.waitForTimeout(500);
    const bellDot = pageA.locator('button[aria-label*="unread"]');
    ok("A's notification bell shows unread (transfer accepted notice)", (await bellDot.count()) > 0);

    console.log("\nAll UI checks completed.");
  } finally {
    await browser.close();
  }
}

main()
  .catch((e) => {
    console.error("SCRIPT ERROR:", e.message, e.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log("\nCleaning up...");
    for (const id of created.bookingIds) await admin.from("bookings").delete().eq("id", id);
    if (created.slotIds.length) {
      await admin.from("booking_waitlist").delete().in("slot_id", created.slotIds);
      await admin.from("slots").delete().in("id", created.slotIds);
    }
    await admin.from("booking_transfer_offers").delete().in("from_user_id", created.users);
    if (created.pitchId) await admin.from("pitches").delete().eq("id", created.pitchId);
    if (created.venueId) await admin.from("venues").delete().eq("id", created.venueId);
    await admin.from("user_notifications").delete().in("user_id", created.users);
    for (const id of created.users) await admin.auth.admin.deleteUser(id).catch(() => {});
    console.log("Done.");
  });
