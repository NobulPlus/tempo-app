import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserNotificationKind } from "@/lib/types";

export async function createUserNotification(input: {
  userId: string;
  kind: UserNotificationKind;
  title: string;
  body: string;
  href?: string;
}) {
  const { error } = await createAdminClient().from("user_notifications").insert({
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href ?? null,
  });
  if (error) console.error("[notifications] create failed:", error.message);
}
