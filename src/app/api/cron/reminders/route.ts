import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/transport";
import { eventReminderEmail } from "@/lib/mail/templates";

/**
 * Kickoff reminders — 1 hour and 30 minutes before a confirmed pitch
 * booking or joined game. Triggered by Vercel Cron (see vercel.json) or any
 * external scheduler hitting this URL with the shared secret — the route
 * doesn't care who calls it, only that they know CRON_SECRET, same
 * signature-check-first posture the Flutterwave webhook route uses.
 *
 * Live mode only: service-role client throughout, no demo-mode branch —
 * there's no real inbox to remind in the in-memory store, and nothing
 * scheduled ever reaches a local demo instance anyway.
 */

const WINDOWS = [
  { minutesUntil: 60 as const, column: "reminder_1h_sent_at", toleranceMin: 5 },
  { minutesUntil: 30 as const, column: "reminder_30m_sent_at", toleranceMin: 5 },
];

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let sentBookings = 0;
  let sentGames = 0;

  for (const win of WINDOWS) {
    const target = new Date(Date.now() + win.minutesUntil * 60_000);
    const from = new Date(target.getTime() - win.toleranceMin * 60_000).toISOString();
    const to = new Date(target.getTime() + win.toleranceMin * 60_000).toISOString();

    // --- direct pitch bookings ---
    const { data: bookings } = await admin
      .from("bookings")
      .select(
        `id, user_id, reference, slot:slots!inner(starts_at, pitch:pitches(name, venue:venues(name, address)))`,
      )
      .eq("status", "confirmed")
      .is(win.column, null)
      .gte("slot.starts_at", from)
      .lte("slot.starts_at", to);

    for (const row of bookings ?? []) {
      const slot = Array.isArray(row.slot) ? row.slot[0] : row.slot;
      const pitch = Array.isArray(slot?.pitch) ? slot.pitch[0] : slot?.pitch;
      const venue = Array.isArray(pitch?.venue) ? pitch.venue[0] : pitch?.venue;
      if (!slot || !pitch || !venue) continue;

      const sent = await sendReminderIfPossible(admin, row.user_id, {
        title: pitch.name,
        venueName: venue.name,
        address: venue.address,
        kickoffISO: slot.starts_at,
        minutesUntil: win.minutesUntil,
        viewUrl: `${site()}/bookings/${row.reference}`,
      });
      if (sent) sentBookings++;
      await admin.from("bookings").update({ [win.column]: new Date().toISOString() }).eq("id", row.id);
    }

    // --- joined games ---
    const { data: participants } = await admin
      .from("game_participants")
      .select(
        `id, user_id, game:games!inner(title, slug, starts_at, pitch:pitches(name, venue:venues(name, address)))`,
      )
      .eq("status", "confirmed")
      .is(win.column, null)
      .gte("game.starts_at", from)
      .lte("game.starts_at", to);

    for (const row of participants ?? []) {
      const game = Array.isArray(row.game) ? row.game[0] : row.game;
      const pitch = Array.isArray(game?.pitch) ? game.pitch[0] : game?.pitch;
      const venue = Array.isArray(pitch?.venue) ? pitch.venue[0] : pitch?.venue;
      if (!game || !pitch || !venue) continue;

      const sent = await sendReminderIfPossible(admin, row.user_id, {
        title: game.title,
        venueName: venue.name,
        address: venue.address,
        kickoffISO: game.starts_at,
        minutesUntil: win.minutesUntil,
        viewUrl: `${site()}/games/${game.slug}`,
      });
      if (sent) sentGames++;
      await admin.from("game_participants").update({ [win.column]: new Date().toISOString() }).eq("id", row.id);
    }
  }

  return NextResponse.json({ sent: sentBookings + sentGames, sentBookings, sentGames });
}

async function sendReminderIfPossible(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  input: {
    title: string;
    venueName: string;
    address: string;
    kickoffISO: string;
    minutesUntil: 60 | 30;
    viewUrl: string;
  },
): Promise<boolean> {
  try {
    const [{ data: authUser }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("full_name, email_notifications_enabled").eq("id", userId).maybeSingle(),
    ]);
    const email = authUser?.user?.email;
    if (!email) return false;
    if (profile?.email_notifications_enabled === false) return false;

    const { subject, html, text } = eventReminderEmail({
      fullName: profile?.full_name ?? "there",
      ...input,
    });
    await sendMail({ to: email, subject, html, text });
    return true;
  } catch (err) {
    console.error("[cron/reminders] send failed:", err);
    return false;
  }
}
