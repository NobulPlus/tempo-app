"use client";

import { useActionState } from "react";
import { updateProfileDetailsAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { Select } from "@/components/ui/select";
import { LAGOS_AREA_OPTIONS } from "@/lib/lagos";
import type { PlayerProfile } from "@/lib/types";

const initial: ActionState = {};

const POSITION_OPTIONS = [
  { value: "GK", label: "Goalkeeper" },
  { value: "DEF", label: "Defender" },
  { value: "MID", label: "Midfielder" },
  { value: "FWD", label: "Forward" },
];

const FOOT_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];

const AREA_OPTIONS = LAGOS_AREA_OPTIONS.map((a) => ({ value: a, label: a }));

export function ProfileDetailsForm({ player }: { player: PlayerProfile }) {
  const [state, formAction, pending] = useActionState(updateProfileDetailsAction, initial);
  useActionToast(state, { skipSuccess: true });

  return (
    <form action={formAction} className="card-t p-6">
      <h2 className="text-[16px] font-bold">Profile details</h2>
      <p className="mt-1 text-[12.5px] text-ink-soft">Shown on your public player profile.</p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">Full name</span>
          <input
            name="fullName"
            defaultValue={player.fullName}
            required
            maxLength={80}
            className="w-full rounded-xl border border-glass-border bg-glass px-3.5 py-2.5 text-[14px] outline-none transition focus:border-green/50"
          />
        </label>

        <Select name="area" label="Area" defaultValue={player.area ?? ""} options={AREA_OPTIONS} placeholder="Select your area" />

        <div className="grid grid-cols-2 gap-3">
          <Select name="position" label="Position" defaultValue={player.position ?? ""} options={POSITION_OPTIONS} placeholder="Not set" />
          <Select name="foot" label="Preferred foot" defaultValue={player.foot ?? ""} options={FOOT_OPTIONS} placeholder="Not set" />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">Bio</span>
          <textarea
            name="bio"
            defaultValue={player.bio ?? ""}
            maxLength={280}
            rows={3}
            placeholder="A line or two other players will see on your profile."
            className="w-full resize-none rounded-xl border border-glass-border bg-glass px-3.5 py-2.5 text-[14px] outline-none transition focus:border-green/50"
          />
        </label>
      </div>

      <button type="submit" disabled={pending} className="btn-t btn-green-t mt-5 !py-2.5 !text-[13.5px]">
        {pending ? "Saving…" : "Save changes"}
      </button>
      {state.ok === false && <p className="mt-2 text-[12px] text-orange">{state.error}</p>}
    </form>
  );
}
