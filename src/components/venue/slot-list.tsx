"use client";

import { useState, useTransition } from "react";
import { setSlotStatusAction } from "@/app/actions";
import { formatDayShort, formatTime, formatNaira } from "@/lib/format";
import type { Slot } from "@/lib/types";

export function SlotList({ slots }: { slots: Slot[] }) {
  const [items, setItems] = useState(slots);
  // Adjusting state during render (React's own recommended pattern for
  // "reset local state when a prop changes") rather than in an effect —
  // useState only captures the initial `slots` value, so without this the
  // newly generated slots would never appear after generateSlotsAction's
  // revalidatePath re-renders the parent Server Component with fresh data.
  const [prevSlots, setPrevSlots] = useState(slots);
  if (slots !== prevSlots) {
    setPrevSlots(slots);
    setItems(slots);
  }

  const byDay = items.reduce<Record<string, Slot[]>>((map, slot) => {
    const key = formatDayShort(slot.startsAt);
    (map[key] ??= []).push(slot);
    return map;
  }, {});

  if (items.length === 0) {
    return (
      <div className="card-t p-6 text-center text-[14px] text-ink-soft">
        No upcoming slots yet — generate some above.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(byDay).map(([day, daySlots]) => (
        <div key={day}>
          <h4 className="mb-2 text-[13px] font-bold uppercase tracking-[.6px] text-ink-muted">
            {day}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {daySlots.map((slot) => (
              <SlotChip
                key={slot.id}
                slot={slot}
                onChanged={(status) =>
                  setItems((prev) => prev.map((s) => (s.id === slot.id ? { ...s, status } : s)))
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotChip({
  slot,
  onChanged,
}: {
  slot: Slot;
  onChanged: (status: Slot["status"]) => void;
}) {
  const [pending, start] = useTransition();
  const canToggle = slot.status === "open" || slot.status === "blocked";

  const toggle = () => {
    const next = slot.status === "blocked" ? "open" : "blocked";
    start(async () => {
      const result = await setSlotStatusAction(slot.id, next);
      if (result.ok) onChanged(next);
    });
  };

  const tone =
    slot.status === "booked"
      ? "border-green/35 bg-green/8 text-green"
      : slot.status === "blocked"
        ? "border-orange/35 bg-orange/8 text-orange"
        : "border-glass-border bg-glass text-ink-soft";

  return (
    <button
      type="button"
      onClick={canToggle ? toggle : undefined}
      disabled={!canToggle || pending}
      title={slot.status === "booked" ? "Booked — can't be blocked" : undefined}
      className={`rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition ${tone} ${
        canToggle ? "cursor-pointer hover:border-green/45" : "cursor-not-allowed opacity-80"
      }`}
    >
      <div className="font-bold">{formatTime(slot.startsAt)}</div>
      <div className="mt-0.5 text-[11px] opacity-80">
        {slot.status === "booked" ? "Booked" : slot.status === "blocked" ? "Blocked" : formatNaira(slot.priceKobo, { compact: true })}
      </div>
    </button>
  );
}
