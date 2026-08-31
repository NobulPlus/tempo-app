"use client";

import { useActionState } from "react";
import { generateSlotsAction, type ActionState } from "@/app/actions";

const initial: ActionState = {};

export function GenerateSlotsForm({ pitchId }: { pitchId: string }) {
  const [state, formAction, pending] = useActionState(generateSlotsAction, initial);

  return (
    <form action={formAction} className="card-t space-y-4 p-6">
      <input type="hidden" name="pitchId" value={pitchId} />
      <div>
        <h3 className="text-[16px] font-bold">Generate availability</h3>
        <p className="mt-1 text-[13px] text-ink-soft">
          Set your hours once — this fills in the individual bookable hours. Safe to
          run again later to extend coverage further out; existing hours are left
          alone.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RuleField label="Opens" name="openHour" defaultValue={6} />
        <RuleField label="Closes" name="closeHour" defaultValue={21} />
        <RuleField label="Peak from" name="peakStartHour" defaultValue={17} />
        <RuleField label="Peak until" name="peakEndHour" defaultValue={20} />
      </div>

      <div className="max-w-[160px]">
        <label className="mb-1 block text-[12px] text-ink-muted">Days ahead</label>
        <input
          name="daysAhead"
          type="number"
          min={1}
          max={60}
          defaultValue={14}
          className="w-full rounded-lg border border-white/12 bg-white/4 px-3 py-2.5 text-[13.5px] outline-none focus:border-green/50"
        />
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t !py-3 !text-[14px]">
        {pending ? "Generating…" : "Generate slots"}
      </button>

      {state.error && <p className="text-[13px] text-orange">{state.error}</p>}
      {state.ok && <p className="text-[13px] text-green">{state.message}</p>}
    </form>
  );
}

function RuleField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-ink-muted">{label}</label>
      <input
        name={name}
        type="number"
        min={0}
        max={23}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-white/12 bg-white/4 px-3 py-2.5 text-[13.5px] outline-none focus:border-green/50"
      />
    </div>
  );
}
