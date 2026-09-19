import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Purges match chat messages 48h after the game ends (delete_expired_game_
 * chat_messages(), supabase/migrations/0046). Same CRON_SECRET-first,
 * service-role-throughout pattern as the other three cron routes; added as
 * a fourth external cron-job.org job, not in vercel.json (Hobby plan blocks
 * anything more frequent than daily).
 */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("delete_expired_game_chat_messages");
  if (error) {
    console.error("[cron/game-chat-cleanup] rpc failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: data ?? 0 });
}
