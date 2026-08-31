"use client";

import { useActionState } from "react";
import { updateVenueAction, type ActionState } from "@/app/actions";
import type { Venue } from "@/lib/types";

const initial: ActionState = {};

export function VenueDetailsForm({ venue }: { venue: Venue }) {
  const [state, formAction, pending] = useActionState(updateVenueAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={venue.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue name" name="name" defaultValue={venue.name} />
        <Field label="Area" name="area" defaultValue={venue.area} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="side" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Lagos side
          </label>
          <select
            id="side"
            name="side"
            defaultValue={venue.side}
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
          >
            <option value="island">Island</option>
            <option value="mainland">Mainland</option>
          </select>
        </div>
        <Field label="Contact phone" name="phone" defaultValue={venue.phone ?? ""} />
      </div>

      <Field label="Street address" name="address" defaultValue={venue.address} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" name="lat" type="number" step="any" defaultValue={String(venue.lat)} />
        <Field label="Longitude" name="lng" type="number" step="any" defaultValue={String(venue.lng)} />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={600}
          defaultValue={venue.description}
          className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t">
        {pending ? "Saving…" : "Save venue details"}
      </button>

      {state.error && <p className="text-[13px] text-orange">{state.error}</p>}
      {state.ok && <p className="text-[13px] text-green">{state.message}</p>}
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
      />
    </div>
  );
}
