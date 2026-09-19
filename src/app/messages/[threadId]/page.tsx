import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getDmThread, getDmMessages, hasBlockedUser } from "@/lib/data/repo";
import { DmThreadPanel } from "@/components/dm/dm-thread-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function DmThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/messages/${threadId}`);

  const thread = await getDmThread(threadId, user.id);
  // RLS returns nothing for a non-member — a stranger hitting this URL
  // directly sees "not found", not a permission error.
  if (!thread || (thread.userA !== user.id && thread.userB !== user.id)) notFound();

  const [messages, isBlocked] = await Promise.all([
    getDmMessages(threadId),
    hasBlockedUser(user.id, thread.otherPlayer.id),
  ]);

  return <DmThreadPanel thread={thread} currentUserId={user.id} initialMessages={messages} isBlocked={isBlocked} />;
}
