import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listDmThreadsForUser } from "@/lib/data/repo";
import { formatDayShort, formatTime } from "@/lib/format";
import { ChatIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
  robots: { index: false, follow: false },
};

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");

  const threads = await listDmThreadsForUser(user.id);

  return (
    <div className="py-12">
      <div className="container-t max-w-2xl">
        <h1 className="font-display text-[clamp(26px,4.5vw,36px)] font-extrabold tracking-[-.02em]">
          Messages
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Direct messages with players you&apos;ve shared a game with.
        </p>

        {threads.length === 0 ? (
          <div className="card-t mt-6 p-8 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green/10 text-green">
              <ChatIcon size={20} />
            </span>
            <p className="mt-3 text-[14px] text-ink-soft">
              Nothing here yet. Play a game together, then message a player from their profile.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/messages/${t.id}`}
                  className="card-t flex items-center gap-4 p-4 transition hover:border-green/30"
                >
                  {t.otherPlayer.avatarUrl ? (
                    <img
                      src={t.otherPlayer.avatarUrl}
                      alt={t.otherPlayer.fullName}
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-green/10 text-[13px] font-bold">
                      {t.otherPlayer.initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-semibold">{t.otherPlayer.fullName}</span>
                      {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-orange" />}
                    </div>
                    <div className="truncate text-[12px] text-ink-muted">@{t.otherPlayer.handle}</div>
                  </div>
                  <div className="shrink-0 text-[11.5px] text-ink-muted">
                    {formatDayShort(t.lastMessageAt)} · {formatTime(t.lastMessageAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
