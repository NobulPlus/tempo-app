"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarIcon, ChevronDownIcon, SearchIcon, ClockIcon, PinIcon, UsersIcon } from "@/components/icons";
import { formatNaira, formatTime } from "@/lib/format";
import type { getBookingsForVenue, getGamesForVenue } from "@/lib/data/repo";

type Booking = Awaited<ReturnType<typeof getBookingsForVenue>>[number];
type Game = Awaited<ReturnType<typeof getGamesForVenue>>[number];

type CalendarEvent =
  | { kind: "booking"; id: string; startsAt: string; pitchName: string; title: string; sub: string; href: string }
  | { kind: "game"; id: string; startsAt: string; pitchName: string; title: string; sub: string; href: string };

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function VenueCalendar({ bookings, games }: { bookings: Booking[]; games: Game[] }) {
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(today);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [q, setQ] = useState("");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart],
  );

  const events: CalendarEvent[] = useMemo(() => {
    const bookingEvents: CalendarEvent[] = bookings
      .filter((b) => b.status === "confirmed")
      .map((b) => ({
        kind: "booking",
        id: b.id,
        startsAt: b.slot.startsAt,
        pitchName: b.slot.pitch.name,
        title: b.player?.fullName ?? "Unknown player",
        sub: `${b.reference} · ${formatNaira(b.totalKobo)}`,
        href: `/bookings/${b.reference}`,
      }));

    const gameEvents: CalendarEvent[] = games.map((g) => ({
      kind: "game",
      id: g.id,
      startsAt: g.startsAt,
      pitchName: g.pitch.name,
      title: g.title,
      sub: `${g.filled}/${g.capacity} filled · hosted by ${g.host.fullName}`,
      href: `/games/${g.slug}`,
    }));

    return [...bookingEvents, ...gameEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [bookings, games]);

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => isSameDay(new Date(e.startsAt), selected))
      .filter((e) => {
        if (!q) return true;
        const hay = `${e.title} ${e.pitchName} ${e.sub}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
  }, [events, selected, q]);

  return (
    <div className="card-t overflow-hidden">
      <div className="flex items-center gap-2 border-b border-glass-border p-4">
        <CalendarIcon size={16} className="text-green" />
        <h2 className="text-[15px] font-bold">Calendar</h2>
      </div>

      <div className="flex items-center gap-2 border-b border-glass-border p-3">
        <button
          type="button"
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-glass hover:text-ink"
          aria-label="Previous week"
        >
          <ChevronDownIcon size={15} className="rotate-90" />
        </button>

        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {weekDays.map((d) => {
            const isSelected = isSameDay(d, selected);
            const isToday = isSameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSelected(d)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-2 transition ${
                  isSelected
                    ? "bg-green text-[#051530]"
                    : isToday
                      ? "bg-green/10 text-green"
                      : "text-ink-soft hover:bg-glass"
                }`}
              >
                <span className="text-[10.5px] font-semibold uppercase tracking-[.5px]">{DAY_LABEL[d.getDay()]}</span>
                <span className="text-[16px] font-extrabold tabular-nums">{String(d.getDate()).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-glass hover:text-ink"
          aria-label="Next week"
        >
          <ChevronDownIcon size={15} className="-rotate-90" />
        </button>
      </div>

      <div className="border-b border-glass-border p-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
            <SearchIcon size={14} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this day's events"
            className="w-full rounded-full border border-glass-border bg-glass py-2 pl-9 pr-4 text-[13px] outline-none transition focus:border-green/50"
          />
        </div>
      </div>

      <div className="p-4">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <CalendarIcon size={22} className="text-ink-muted" />
            <p className="text-[13.5px] font-semibold text-ink-soft">No events to show yet</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {dayEvents.map((e) => (
              <li key={`${e.kind}-${e.id}`}>
                <Link
                  href={e.href}
                  className="flex items-center gap-3.5 rounded-xl border border-glass-border bg-glass p-3.5 transition hover:border-green/35"
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      e.kind === "booking" ? "bg-green/12 text-green" : "bg-purple/12 text-purple"
                    }`}
                  >
                    {e.kind === "booking" ? <ClockIcon size={17} /> : <UsersIcon size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{e.title}</span>
                      <span className="chip-t !py-0.5 !text-[10px]">{e.kind === "booking" ? "Booking" : "Game"}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <PinIcon size={11} />
                        {e.pitchName}
                      </span>
                      <span>{e.sub}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-[13px] font-bold text-ink-soft">{formatTime(e.startsAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
