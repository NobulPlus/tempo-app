"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira, formatTime, formatRelativeDay } from "@/lib/format";
import { ClockIcon, LightningIcon } from "@/components/icons";
import type { Slot } from "@/lib/types";

/**
 * Availability calendar + slot picker.
 *
 * The prototype's "Book" button did nothing. This is the flow it implied:
 * pick a day, see real open hours with real peak pricing, choose one, go to
 * checkout. Booked hours are shown rather than hidden — seeing that 7pm is
 * gone is what makes 8pm feel worth taking.
 */
export function SlotPicker({ slots, pitchSlug }: { slots: Slot[]; pitchSlug: string }) {
  const router = useRouter();

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = new Date(s.startsAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()].slice(0, 7);
  }, [slots]);

  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<Slot | null>(null);

  if (days.length === 0) {
    return (
      <div className="card-t p-8 text-center">
        <p className="text-ink-soft">
          No availability published for the next 7 days. Try another pitch, or ask the
          venue to open more slots.
        </p>
      </div>
    );
  }

  const [, daySlots] = days[dayIndex];
  const openCount = daySlots.filter((s) => s.status === "open").length;

  return (
    <div className="card-t p-5 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold">Pick your time</h2>
        <span className="text-[13px] text-ink-muted">Prices shown per hour</span>
      </div>

      {/* Day strip */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {days.map(([key, list], i) => {
          const open = list.filter((s) => s.status === "open").length;
          const active = i === dayIndex;
          return (
            <button
              key={key}
              onClick={() => {
                setDayIndex(i);
                setSelected(null);
              }}
              aria-pressed={active}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition ${
                active
                  ? "border-green/50 bg-green/12"
                  : "border-white/10 bg-white/4 hover:border-white/25"
              }`}
            >
              <div className={`text-[13px] font-semibold ${active ? "text-green" : ""}`}>
                {formatRelativeDay(list[0].startsAt)}
              </div>
              <div className="text-[11.5px] text-ink-muted">
                {open > 0 ? `${open} open` : "Fully booked"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hours */}
      {openCount === 0 ? (
        <p className="mt-6 rounded-xl border border-white/10 bg-white/4 p-6 text-center text-[14.5px] text-ink-soft">
          Every hour is taken on this day. Try the next one — evenings go first.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {daySlots.map((s) => {
            const isOpen = s.status === "open";
            const isSelected = selected?.id === s.id;
            const peak = s.priceKobo > (daySlots[0]?.priceKobo ?? 0);

            return (
              <button
                key={s.id}
                disabled={!isOpen}
                onClick={() => setSelected(s)}
                aria-pressed={isSelected}
                className={`relative rounded-xl border px-2 py-3 text-center transition ${
                  isSelected
                    ? "border-green bg-green/16 shadow-[0_0_0_1px_rgba(0,230,118,.4)]"
                    : isOpen
                      ? "border-white/12 bg-white/4 hover:border-green/40 hover:bg-green/8"
                      : "cursor-not-allowed border-white/6 bg-white/2 opacity-40"
                }`}
              >
                <div className={`text-[14px] font-bold ${isSelected ? "text-green" : ""}`}>
                  {formatTime(s.startsAt)}
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-muted">
                  {isOpen ? formatNaira(s.priceKobo, { compact: true }) : "Taken"}
                </div>
                {isOpen && peak && (
                  <span
                    className="absolute right-1.5 top-1.5 text-gold"
                    title="Peak hour pricing"
                  >
                    <LightningIcon size={10} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary bar */}
      <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 text-[14px]">
          <ClockIcon size={17} className="text-ink-muted" />
          {selected ? (
            <span>
              <b>{formatRelativeDay(selected.startsAt)}</b> at{" "}
              <b>{formatTime(selected.startsAt)}</b> — 1 hour
            </span>
          ) : (
            <span className="text-ink-muted">No time selected yet</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {selected && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-ink-muted">Total</div>
              <div className="text-[20px] font-extrabold">{formatNaira(selected.priceKobo)}</div>
            </div>
          )}
          <button
            disabled={!selected}
            onClick={() =>
              selected && router.push(`/pitches/${pitchSlug}/book?slot=${selected.id}`)
            }
            className="btn-t btn-green-t !py-3.5"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
