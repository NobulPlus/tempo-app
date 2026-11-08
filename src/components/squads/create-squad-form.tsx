"use client";

import { useActionState } from "react";
import { createSquadAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export function CreateSquadForm({ areaOptions }: { areaOptions: readonly string[] }) {
  const [state, action, pending] = useActionState(createSquadAction, initial);
  useActionToast(state, { skipSuccess: true });

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Squad name</label>
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Tuesday Night Regulars"
          className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Description (optional)</label>
        <textarea
          name="description"
          maxLength={400}
          rows={3}
          placeholder="What's this squad about?"
          className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Area (optional)</label>
        <select
          name="area"
          defaultValue=""
          className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3.5 text-[15px] outline-none transition focus:border-green/50"
        >
          <option value="">Not set</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Creating..." : "Create squad"}
      </button>
    </form>
  );
}
