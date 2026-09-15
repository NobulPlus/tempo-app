"use client";

import { useMemo, useState } from "react";
import { AMENITY_OPTIONS, ACTIVITY_OPTIONS, venueOptionLabel } from "@/lib/venue-options";
import { Select } from "@/components/ui/select";

export function VenueActivityFields({
  primary,
  supported = [],
}: {
  primary?: string;
  supported?: string[];
}) {
  const initialPrimary = primary ?? "football";
  const initialAdditional = supported.filter((activity) => activity !== initialPrimary);
  const [primaryActivity, setPrimaryActivity] = useState(initialPrimary);
  const [selected, setSelected] = useState(() => new Set(initialAdditional));

  const options = useMemo(() => ACTIVITY_OPTIONS, []);
  const additionalOptions = options.filter((option) => option.value !== primaryActivity);

  return (
    <div className="rounded-xl border border-glass-border bg-bg-primary/30 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="activityType" className="block text-[13px] font-semibold text-ink-soft">
            Primary activity
          </label>
          <p className="mt-1 text-[12px] text-ink-muted">
            Choose the main category for this venue.
          </p>
        </div>
        <Select
          name="activityType"
          defaultValue={initialPrimary}
          options={[...options]}
          className="w-full sm:max-w-[220px]"
          onChange={(value) => {
            setPrimaryActivity(value);
            setSelected((current) => {
              const next = new Set(current);
              next.delete(value);
              return next;
            });
          }}
        />
      </div>

      <div className="mt-4">
        <input type="hidden" name="supportedActivities" value={primaryActivity} readOnly />
        <div className="mb-2 text-[13px] font-semibold text-ink-soft">Additional supported activities</div>
        <p className="mb-2 text-[12px] text-ink-muted">
          Optional. Pick only the other activities this venue can host.
        </p>
        <div className="flex flex-wrap gap-2">
          {additionalOptions.map((option) => {
            const checked = selected.has(option.value);
            return (
              <label
                key={option.value}
                className={`chip-t cursor-pointer transition ${
                  checked ? "!border-green/45 !bg-green/14 !text-green" : "hover:border-green/30"
                }`}
              >
                <input
                  type="checkbox"
                  name="supportedActivities"
                  value={option.value}
                  defaultChecked={checked}
                  className="sr-only"
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(option.value);
                      else next.delete(option.value);
                      return next;
                    });
                  }}
                />
                {venueOptionLabel(options, option.value)}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function VenueAmenityFields({ selected = [] }: { selected?: string[] }) {
  const [picked, setPicked] = useState(() => new Set(selected));

  return (
    <div className="rounded-xl border border-glass-border bg-bg-primary/30 p-4">
      <div className="mb-2">
        <div className="text-[13px] font-semibold text-ink-soft">Venue features</div>
        <p className="mt-1 text-[12px] text-ink-muted">
          These become searchable trust signals for players and useful context for admin verification.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {AMENITY_OPTIONS.map((option) => {
          const checked = picked.has(option.value);
          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition ${
                checked
                  ? "border-green/45 bg-green/12 text-green"
                  : "border-glass-border bg-glass text-ink-soft hover:border-green/30"
              }`}
            >
              <span>{option.label}</span>
              <input
                type="checkbox"
                name="amenities"
                value={option.value}
                defaultChecked={checked}
                className="h-4 w-4 accent-green"
                onChange={(event) => {
                  setPicked((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(option.value);
                    else next.delete(option.value);
                    return next;
                  });
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
