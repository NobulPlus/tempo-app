"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePitchAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { ClockIcon } from "@/components/icons";
import type { Pitch } from "@/lib/types";

const initial: ActionState = {};

export function PitchManageCard({ venueId, pitch }: { venueId: string; pitch: Pitch }) {
  const [state, formAction, pending] = useActionState(updatePitchAction, initial);
  const [toggleState, toggleAction, togglePending] = useActionState(updatePitchAction, initial);

  return (
    <div className="card-t p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-bold">{pitch.name}</h4>
            <span className="chip-t">{pitch.size}</span>
            {!pitch.active && (
              <span className="chip-t !border-orange/35 !bg-orange/12 !text-orange">
                Unpublished
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted">
            {pitch.surface} · {formatNaira(pitch.pricePerHourKobo)}/hr
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/venue/${venueId}/pitches/${pitch.id}`}
            className="btn-t btn-ghost-t !px-3.5 !py-2 !text-[13px]"
          >
            <ClockIcon size={14} />
            Availability
          </Link>
          <form action={toggleAction}>
            <input type="hidden" name="pitchId" value={pitch.id} />
            <input type="hidden" name="active" value={pitch.active ? "false" : "true"} />
            <button
              type="submit"
              disabled={togglePending}
              className={`btn-t !px-3.5 !py-2 !text-[13px] ${pitch.active ? "btn-ghost-t" : "btn-green-t"}`}
            >
              {togglePending ? "Working…" : pitch.active ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>
      {toggleState.error && <p className="mt-2 text-[12px] text-orange">{toggleState.error}</p>}

      <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
        <input type="hidden" name="pitchId" value={pitch.id} />
        <div>
          <label className="mb-1 block text-[11.5px] text-ink-muted">Price/hr (₦)</label>
          <input
            name="pricePerHourNaira"
            type="number"
            min={500}
            step={500}
            defaultValue={pitch.pricePerHourKobo / 100}
            className="w-full rounded-lg border border-white/12 bg-white/4 px-2.5 py-2 text-[13px] outline-none focus:border-green/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11.5px] text-ink-muted">Peak ×</label>
          <input
            name="peakMultiplier"
            type="number"
            min={1}
            max={3}
            step={0.1}
            defaultValue={pitch.peakMultiplier}
            className="w-full rounded-lg border border-white/12 bg-white/4 px-2.5 py-2 text-[13px] outline-none focus:border-green/50"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            name="floodlights"
            defaultChecked={pitch.floodlights}
            className="h-3.5 w-3.5 accent-green"
          />
          <input type="hidden" name="floodlights" value="off" />
          Floodlights
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
          <input
            type="checkbox"
            name="covered"
            defaultChecked={pitch.covered}
            className="h-3.5 w-3.5 accent-green"
          />
          <input type="hidden" name="covered" value="off" />
          Covered
        </label>
        <div className="col-span-2 sm:col-span-4">
          <button type="submit" disabled={pending} className="btn-t btn-ghost-t !px-4 !py-2 !text-[12.5px]">
            {pending ? "Saving…" : "Save changes"}
          </button>
          {state.error && <span className="ml-3 text-[12px] text-orange">{state.error}</span>}
          {state.ok && <span className="ml-3 text-[12px] text-green">Saved.</span>}
        </div>
      </form>
    </div>
  );
}
