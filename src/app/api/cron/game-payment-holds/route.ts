import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail/transport";
import { gameCancelledEmail, gameHoldExpiredEmail } from "@/lib/mail/templates";

/**
 * Expires payment holds — a player who joined a paid game but couldn't
 * cover the full price gets 48h (capped to 2h before kickoff) to top up
 * the rest via pay_game_balance(). Past that deadline, expire_unpaid_game_
 * holds() (supabase/migrations/0023) refunds what they'd paid, drops them,
 * and promotes the next waitlisted player — this route just triggers that
 * and emails whoever got bumped. Same CRON_SECRET-first, service-role-
 * throughout pattern as src/app/api/cron/reminders/route.ts; added as a
 * second entry in vercel.json's crons array, same 10-minute cadence.
 */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [
    { data: expired, error },
    { data: settledGames, error: settlementError },
    { data: bookingHoldsExpired, error: bookingHoldsError },
  ] = await Promise.all([
    admin.rpc("expire_unpaid_game_holds"),
    admin.rpc("settle_ended_host_games"),
    admin.rpc("expire_booking_slot_holds"),
  ]);
  if (error) {
    console.error("[cron/game-payment-holds] rpc failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (settlementError) {
    console.error("[cron/game-payment-holds] host settlement rpc failed:", settlementError);
    return NextResponse.json({ error: settlementError.message }, { status: 500 });
  }
  if (bookingHoldsError) {
    console.error("[cron/game-payment-holds] booking slot hold expiry failed:", bookingHoldsError);
    return NextResponse.json({ error: bookingHoldsError.message }, { status: 500 });
  }

  const { data: staleMinimumGames, error: minimumError } = await admin.rpc("expire_stale_minimum_decisions");
  if (minimumError) {
    console.error("[cron/game-payment-holds] minimum-decision rpc failed:", minimumError);
    return NextResponse.json({ error: minimumError.message }, { status: 500 });
  }

  let notified = 0;
  for (const row of expired ?? []) {
    try {
      const [{ data: authUser }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(row.user_id),
        admin.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle(),
      ]);
      const email = authUser?.user?.email;
      if (!email) continue;

      const { subject, html, text } = gameHoldExpiredEmail({
        fullName: profile?.full_name ?? "there",
        title: row.game_title,
        venueName: row.venue_name,
        kickoffISO: row.kickoff_at,
        refundedKobo: Number(row.refunded_kobo ?? 0),
      });
      await sendMail({ to: email, subject, html, text });
      notified++;
    } catch (err) {
      console.error("[cron/game-payment-holds] notify failed:", err);
    }
  }

  let cancelledMinimumGamesNotified = 0;
  for (const row of staleMinimumGames ?? []) {
    cancelledMinimumGamesNotified += await notifyCancelledGameRefunds(admin, {
      gameId: row.game_id,
      title: row.game_title,
      venueName: row.venue_name,
      kickoffISO: row.kickoff_at,
    });
  }

  return NextResponse.json({
    expired: expired?.length ?? 0,
    hostGamesSettled: settledGames ?? 0,
    bookingSlotHoldsExpired: bookingHoldsExpired ?? 0,
    staleMinimumGamesCancelled: staleMinimumGames?.length ?? 0,
    notified,
    cancelledMinimumGamesNotified,
  });
}

async function notifyCancelledGameRefunds(
  admin: ReturnType<typeof createAdminClient>,
  game: { gameId: string; title: string; venueName: string; kickoffISO: string },
): Promise<number> {
  const { data: rows } = await admin
    .from("game_cancellation_refunds")
    .select("id, user_id, amount_kobo")
    .eq("game_id", game.gameId)
    .is("notified_at", null);

  let notified = 0;
  for (const row of rows ?? []) {
    try {
      const [{ data: authUser }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(row.user_id),
        admin.from("profiles").select("full_name").eq("id", row.user_id).maybeSingle(),
      ]);
      const email = authUser?.user?.email;
      if (!email) continue;

      const content = gameCancelledEmail({
        fullName: profile?.full_name ?? "there",
        title: game.title,
        venueName: game.venueName,
        kickoffISO: game.kickoffISO,
        refundedKobo: Math.max(0, Number(row.amount_kobo ?? 0)),
      });
      await sendMail({ to: email, ...content });
      await admin
        .from("game_cancellation_refunds")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", row.id);
      notified++;
    } catch (err) {
      console.error("[cron/game-payment-holds] cancellation notify failed:", err);
    }
  }
  return notified;
}
