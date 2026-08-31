"use client";

import { useActionState } from "react";
import { createVenueAction, type ActionState } from "@/app/actions";
import { BuildingIcon, PinIcon } from "@/components/icons";

const initial: ActionState = {};

export function CreateVenueForm() {
  const [state, formAction, pending] = useActionState(createVenueAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="field-t">
        <input id="name" name="name" required placeholder=" " />
        <span className="field-icon">
          <BuildingIcon size={18} />
        </span>
        <label htmlFor="name" className="floating">
          Venue name
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field-t">
          <input id="area" name="area" required placeholder=" " />
          <span className="field-icon">
            <PinIcon size={18} />
          </span>
          <label htmlFor="area" className="floating">
            Area (e.g. Lekki Phase 1)
          </label>
        </div>

        <div>
          <label htmlFor="side" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
            Lagos side
          </label>
          <select
            id="side"
            name="side"
            defaultValue="island"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
          >
            <option value="island">Island</option>
            <option value="mainland">Mainland</option>
          </select>
        </div>
      </div>

      <div className="field-t">
        <input id="address" name="address" required placeholder=" " />
        <span className="field-icon">
          <PinIcon size={18} />
        </span>
        <label htmlFor="address" className="floating">
          Street address
        </label>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
          <PinIcon size={15} />
          Coordinates
        </div>
        <p className="mt-1 text-[12px] text-ink-muted">
          Right-click your venue on Google Maps and copy the two numbers it shows —
          that&apos;s latitude and longitude.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <input
            name="lat"
            type="number"
            step="any"
            required
            placeholder="Latitude, e.g. 6.4531"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
          />
          <input
            name="lng"
            type="number"
            step="any"
            required
            placeholder="Longitude, e.g. 3.4231"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
          />
        </div>
      </div>

      <div className="field-t">
        <input id="phone" name="phone" type="tel" placeholder=" " />
        <label htmlFor="phone" className="floating">
          Contact phone (optional)
        </label>
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={600}
          placeholder="What makes this venue worth booking?"
          className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Creating…" : "Create venue"}
      </button>

      {state.error && (
        <p role="alert" className="rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-center text-[13.5px] text-orange">
          {state.error}
        </p>
      )}

      <p className="text-center text-[12px] text-ink-muted">
        New venues start unverified — someone from Tempo visits in person before
        it&apos;s bookable. You can add pitches and availability right away.
      </p>
    </form>
  );
}
