"use client";

import { useActionState, useRef, useEffect } from "react";
import { createPitchAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

const SIZES = ["5-a-side", "7-a-side", "11-a-side"] as const;
const SURFACES = ["astro", "grass", "indoor", "concrete"] as const;

export function AddPitchForm({ venueId }: { venueId: string }) {
  const [state, formAction, pending] = useActionState(createPitchAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="card-t space-y-4 p-6">
      <input type="hidden" name="venueId" value={venueId} />
      <h3 className="text-[16px] font-bold">Add a pitch</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pitch-name" className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">
            Pitch name
          </label>
          <input
            id="pitch-name"
            name="name"
            required
            placeholder="e.g. Pitch A"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-3.5 py-3 text-[14px] outline-none transition focus:border-green/50"
          />
        </div>
        <div>
          <label htmlFor="pitch-size" className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">
            Size
          </label>
          <select
            id="pitch-size"
            name="size"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-3.5 py-3 text-[14px] outline-none transition focus:border-green/50"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pitch-surface" className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">
            Surface
          </label>
          <select
            id="pitch-surface"
            name="surface"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-3.5 py-3 text-[14px] outline-none transition focus:border-green/50"
          >
            {SURFACES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pitch-price" className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">
            Price per hour (₦)
          </label>
          <input
            id="pitch-price"
            name="pricePerHourNaira"
            type="number"
            min={500}
            step={500}
            required
            placeholder="30000"
            className="w-full rounded-xl border border-white/12 bg-white/4 px-3.5 py-3 text-[14px] outline-none transition focus:border-green/50"
          />
        </div>
      </div>

      <div>
        <label htmlFor="peak-multiplier" className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">
          Peak multiplier (weekday 5-9pm)
        </label>
        <input
          id="peak-multiplier"
          name="peakMultiplier"
          type="number"
          min={1}
          max={3}
          step={0.1}
          defaultValue={1.3}
          className="w-full max-w-[140px] rounded-xl border border-white/12 bg-white/4 px-3.5 py-3 text-[14px] outline-none transition focus:border-green/50"
        />
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-[13.5px] text-ink-soft">
          <input type="checkbox" name="floodlights" defaultChecked className="h-4 w-4 accent-green" />
          Floodlights
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-ink-soft">
          <input type="checkbox" name="covered" className="h-4 w-4 accent-green" />
          Covered
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t !py-3 !text-[14px]">
        {pending ? "Adding…" : "Add pitch"}
      </button>

      {state.error && <p className="text-[13px] text-orange">{state.error}</p>}
      {state.ok && <p className="text-[13px] text-green">{state.message}</p>}
    </form>
  );
}
