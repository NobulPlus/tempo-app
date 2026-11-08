"use client";

import { useActionState, useState } from "react";
import { saveSquadRecurringTemplateAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { OptionRow } from "@/components/ui/option-row";
import { LAGOS_AREA_OPTIONS } from "@/lib/lagos";
import type { SquadRecurringTemplate } from "@/lib/types";

const initial: ActionState = {};

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const DURATIONS = [60, 90, 120, 180, 240];

export function SquadTemplateForm({
  squadId,
  squadSlug,
  template,
  pitchOptions,
}: {
  squadId: string;
  squadSlug: string;
  template: SquadRecurringTemplate | null;
  pitchOptions: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveSquadRecurringTemplateAction, initial);
  useActionToast(state);

  const [venueMode, setVenueMode] = useState<"pitch" | "off_platform">(template?.venueMode ?? "off_platform");
  const [dayOfWeek, setDayOfWeek] = useState(template?.dayOfWeek ?? 2);
  const [startTime, setStartTime] = useState(
    template ? `${String(Math.floor(template.startMinute / 60)).padStart(2, "0")}:${String(template.startMinute % 60).padStart(2, "0")}` : "19:00",
  );
  const [durationMinutes, setDurationMinutes] = useState(template?.durationMinutes ?? 90);
  const [capacity, setCapacity] = useState(template?.capacity ?? 10);
  const [minimum, setMinimum] = useState(template?.minimumToGuarantee ?? 8);
  const [priceNaira, setPriceNaira] = useState(template ? template.pricePerPlayerKobo / 100 : 0);
  const [bibsProvided, setBibsProvided] = useState(template?.bibsProvided ?? false);
  const [pitchId, setPitchId] = useState(template?.pitchId ?? pitchOptions[0]?.id ?? "");
  const [venueName, setVenueName] = useState(template?.venueName ?? "");
  const [venueArea, setVenueArea] = useState(template?.venueArea ?? "");
  const [venueAddress, setVenueAddress] = useState(template?.venueAddress ?? "");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="squadId" value={squadId} />
      <input type="hidden" name="squadSlug" value={squadSlug} />
      {template && <input type="hidden" name="templateId" value={template.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Day</label>
          <select
            name="dayOfWeek"
            value={dayOfWeek}
            onChange={(event) => setDayOfWeek(Number(event.target.value))}
            className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3 text-[14px] outline-none transition focus:border-green/50"
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Start time</label>
          <input
            type="time"
            name="startTime"
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-[14px] outline-none transition focus:border-green/50"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Duration</label>
        <select
          name="durationMinutes"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(Number(event.target.value))}
          className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3 text-[14px] outline-none transition focus:border-green/50"
        >
          {DURATIONS.map((m) => (
            <option key={m} value={m}>
              {m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <OptionRow
          selected={venueMode === "off_platform"}
          onClick={() => setVenueMode("off_platform")}
          label="Off-platform venue"
          hint="Your own regular spot, not on Tempo."
        />
        <OptionRow
          selected={venueMode === "pitch"}
          onClick={() => setVenueMode("pitch")}
          label="A Tempo pitch"
          hint="Needs a matching open slot each week."
        />
      </div>
      <input type="hidden" name="venueMode" value={venueMode} />

      {venueMode === "pitch" ? (
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Pitch</label>
          <select
            name="pitchId"
            value={pitchId}
            onChange={(event) => setPitchId(event.target.value)}
            className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3 text-[14px] outline-none transition focus:border-green/50"
          >
            {pitchOptions.length === 0 && <option value="">No pitches available</option>}
            {pitchOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-ink-muted">
            Each week, Tempo books an open slot at this pitch for the exact time above. If none exists
            that week, you&apos;ll be notified to book manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Venue name</label>
            <input
              name="venueName"
              required
              minLength={2}
              maxLength={120}
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              placeholder="e.g. Chisco Astro Turf"
              className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-[14px] outline-none transition focus:border-green/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Area</label>
            <select
              name="venueArea"
              required
              value={venueArea}
              onChange={(event) => setVenueArea(event.target.value)}
              className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3 text-[14px] outline-none transition focus:border-green/50"
            >
              <option value="" disabled>
                Choose an area
              </option>
              {LAGOS_AREA_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Address or landmark</label>
            <textarea
              name="venueAddress"
              required
              minLength={5}
              maxLength={240}
              rows={2}
              value={venueAddress}
              onChange={(event) => setVenueAddress(event.target.value)}
              className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-[14px] outline-none transition focus:border-green/50"
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Total spots</label>
          <input
            type="number"
            name="capacity"
            min={4}
            max={30}
            value={capacity}
            onChange={(event) => {
              const value = Number(event.target.value);
              setCapacity(value);
              if (minimum > value) setMinimum(value);
            }}
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-[14px] outline-none transition focus:border-green/50"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Minimum to go ahead</label>
          <input
            type="number"
            name="minimumToGuarantee"
            min={2}
            max={capacity}
            value={minimum}
            onChange={(event) => setMinimum(Number(event.target.value))}
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-[14px] outline-none transition focus:border-green/50"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Price per player</label>
        <div className="flex items-center rounded-xl border border-white/12 bg-white/4 px-4">
          <span className="text-[14px] font-bold text-ink-muted">₦</span>
          <input
            type="number"
            name="pricePerPlayerNaira"
            min={0}
            step={500}
            value={priceNaira}
            onChange={(event) => setPriceNaira(Number(event.target.value))}
            className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-[14px] outline-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 text-[13.5px] text-ink-soft">
        <input
          type="checkbox"
          name="bibsProvided"
          checked={bibsProvided}
          onChange={(event) => setBibsProvided(event.target.checked)}
          className="h-4 w-4 accent-[#00e676]"
        />
        We bring bibs
      </label>

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Saving..." : template ? "Save changes" : "Save weekly schedule"}
      </button>
    </form>
  );
}
