"use client";

import { useState } from "react";
import {
  ACTIVITY_OPTIONS,
  RESOURCE_FEATURE_OPTIONS,
  RESOURCE_TYPE_OPTIONS,
  venueOptionLabel,
} from "@/lib/venue-options";
import { Select } from "@/components/ui/select";

export function ResourceTypeField({ defaultValue = "pitch" }: { defaultValue?: string }) {
  return (
    <Select
      label="Resource type"
      name="resourceType"
      defaultValue={defaultValue}
      options={[...RESOURCE_TYPE_OPTIONS]}
      hint="What kind of bookable space is this?"
    />
  );
}

export function ResourceActivityFields({
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
  const additionalOptions = ACTIVITY_OPTIONS.filter((option) => option.value !== primaryActivity);

  return (
    <div className="rounded-xl border border-glass-border bg-bg-primary/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
        <div>
          <div className="text-[13px] font-semibold text-ink-soft">Activity fit</div>
          <p className="mt-1 text-[12px] text-ink-muted">
            The primary activity drives discovery. Add other activities only if this space can genuinely host them.
          </p>
        </div>
        <Select
          name="activityType"
          defaultValue={initialPrimary}
          options={[...ACTIVITY_OPTIONS]}
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

      <input type="hidden" name="supportedActivities" value={primaryActivity} readOnly />
      <div className="mt-4 flex flex-wrap gap-2">
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
              {venueOptionLabel(ACTIVITY_OPTIONS, option.value)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ResourceFeatureFields({ selected = [] }: { selected?: string[] }) {
  const [picked, setPicked] = useState(() => new Set(selected));

  return (
    <div className="rounded-xl border border-glass-border bg-bg-primary/30 p-4">
      <input type="hidden" name="amenitiesMarker" value="1" readOnly />
      <div className="mb-3">
        <div className="text-[13px] font-semibold text-ink-soft">Resource features</div>
        <p className="mt-1 text-[12px] text-ink-muted">
          Features here describe this exact space, not the whole venue.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCE_FEATURE_OPTIONS.map((option) => {
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
