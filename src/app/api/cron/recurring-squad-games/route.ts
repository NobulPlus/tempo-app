import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserNotification } from "@/lib/notifications";
import { lagosCalendarDay, dateFromLagos } from "@/lib/data/repo";

/**
 * Turns each enabled squad_recurring_templates row into this week's hosted
 * game, same "saved rule -> cron regenerates" shape as
 * replenishSavedPitchAvailability() (src/lib/data/repo.ts), but for a
 * squad's weekly game instead of a venue's slot calendar. Date math happens
 * here in TS rather than in the create_squad_recurring_game() SQL function,
 * which only does the (idempotent) insert — same division used everywhere
 * else in this app between data functions and the cron that drives them.
 *
 * Members are notified, never auto-joined (see migration 0066) — they use
 * the normal join_game() flow from the notification link.
 */

const CREATE_AHEAD_DAYS = 6;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: templates, error } = await admin
    .from("squad_recurring_templates")
    .select("*")
    .eq("enabled", true);
  if (error) {
    console.error("[cron/recurring-squad-games] load templates failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let created = 0;
  let skipped = 0;
  let ownerNotified = 0;
  let memberNotified = 0;

  for (const template of templates ?? []) {
    try {
      const occurrence = nextOccurrence(template.day_of_week, template.start_minute);
      const daysOut = (occurrence.getTime() - Date.now()) / 86_400_000;
      if (daysOut > CREATE_AHEAD_DAYS) {
        skipped++;
        continue;
      }
      if (
        template.last_generated_occurrence &&
        new Date(template.last_generated_occurrence).getTime() === occurrence.getTime()
      ) {
        skipped++;
        continue;
      }

      const endsAt = new Date(occurrence.getTime() + template.duration_minutes * 60_000);
      const { data: game, error: createError } = await admin.rpc("create_squad_recurring_game", {
        p_template_id: template.id,
        p_starts_at: occurrence.toISOString(),
        p_ends_at: endsAt.toISOString(),
      });

      if (createError) {
        if (createError.message.includes("no open slot") || createError.message.includes("insufficient wallet")) {
          const { data: squad } = await admin.from("squads").select("owner_id, name").eq("id", template.squad_id).maybeSingle();
          if (squad) {
            await createUserNotification({
              userId: squad.owner_id,
              kind: "system",
              title: `${squad.name}'s weekly game needs attention`,
              body: createError.message.includes("no open slot")
                ? "Couldn't find an open slot at your chosen pitch for this week — pick one manually or switch to an off-platform venue."
                : "Not enough Tempo credit to reserve this week's pitch — top up your wallet or switch to an off-platform venue.",
              href: "/squads",
            });
            ownerNotified++;
          }
        } else {
          console.error("[cron/recurring-squad-games] create failed:", template.id, createError.message);
        }
        continue;
      }

      created++;
      const { data: members } = await admin.from("squad_members").select("user_id").eq("squad_id", template.squad_id);
      for (const member of members ?? []) {
        await createUserNotification({
          userId: member.user_id,
          kind: "squad_game_scheduled",
          title: "This week's squad game is up",
          body: `${game.title} — join before the spots fill.`,
          href: `/games/${game.slug}`,
        });
        memberNotified++;
      }
    } catch (err) {
      console.error("[cron/recurring-squad-games] template failed:", template.id, err);
    }
  }

  return NextResponse.json({ created, skipped, ownerNotified, memberNotified });
}

function nextOccurrence(dayOfWeek: number, startMinute: number): Date {
  const now = new Date();
  for (let addDays = 0; addDays < 8; addDays++) {
    const day = lagosCalendarDay(now, addDays);
    if (day.dayOfWeek !== dayOfWeek) continue;
    const candidate = dateFromLagos(day.year, day.month, day.day, startMinute);
    if (candidate > now) return candidate;
  }
  const day = lagosCalendarDay(now, 7);
  return dateFromLagos(day.year, day.month, day.day, startMinute);
}
