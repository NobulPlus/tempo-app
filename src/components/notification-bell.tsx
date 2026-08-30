"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon, FlameIcon, CheckIcon, ClockIcon, UsersIcon } from "./icons";
import { notifications as initialNotifications, type NotificationType } from "@/lib/mock/notifications";

const ICON: Record<NotificationType, typeof BellIcon> = {
  game_created: FlameIcon,
  reminder: ClockIcon,
  waitlist_promoted: CheckIcon,
  joined: UsersIcon,
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ isDemo }: { isDemo: boolean }) {
  // Real notifications aren't built yet — no notifications table exists.
  // Showing the mock set to a real signed-in user would look like genuine
  // activity that never happened, so it's demo-mode only.
  const [items, setItems] = useState(isDemo ? initialNotifications : []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-[34px] w-[34px] place-items-center rounded-full text-ink-soft transition hover:bg-glass hover:text-ink"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[1200] w-[340px] overflow-hidden rounded-2xl border border-glass-border bg-bg-card shadow-[0_20px_50px_-12px_rgba(0,0,0,.5)]">
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
            <span className="text-[14px] font-bold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
                className="text-[12.5px] font-semibold text-green transition hover:opacity-80"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-[13.5px] text-ink-soft">
                Nothing yet — you&apos;ll hear about new games and reminders here.
              </p>
            ) : (
              items.map((n) => {
                const Icon = ICON[n.type];
                return (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                      setOpen(false);
                    }}
                    className={`flex gap-3 border-b border-glass-border px-4 py-3.5 transition last:border-b-0 hover:bg-glass ${
                      n.read ? "" : "bg-green/5"
                    }`}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green/12 text-green">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold">{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-ink-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block border-t border-glass-border px-4 py-3 text-center text-[12.5px] font-semibold text-ink-soft transition hover:text-ink"
          >
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}
