import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserNotification } from "@/lib/notifications";

/**
 * Daily host-tier recompute. There's no reliable "game just ended" event to
 * hook (games.status never transitions to 'played' anywhere in this app),
 * so tiers are recomputed on a schedule instead of per-event — a day of lag
 * before a new tier affects search placement is an acceptable tradeoff.
 * Same bearer-secret posture as every other cron route (see reminders).
 *
 * recompute_all_host_tiers() returns only the users who were actually
 * promoted this run (tier increased) — notifications are sent here, not in
 * SQL, matching this project's convention (see notification-bell.tsx).
 */
const TIER_LABEL: Record<string, string> = { silver: "Silver", gold: "Gold", elite: "Elite" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("recompute_all_host_tiers");
  if (error) {
    console.error("[cron/recompute-host-tiers] failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const promoted = (data ?? []) as { user_id: string; new_tier: string }[];
  for (const row of promoted) {
    await createUserNotification({
      userId: row.user_id,
      kind: "tier_promoted",
      title: `You're now a ${TIER_LABEL[row.new_tier] ?? row.new_tier} host`,
      body: "Hosting more games in the last 30 days unlocked a new tier — check your host dashboard for the perks.",
      href: "/host/manage",
    });
  }

  return NextResponse.json({ promoted: promoted.length });
}
