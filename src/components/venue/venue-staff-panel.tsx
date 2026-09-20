"use client";

import { useActionState } from "react";
import { setVenueStaffAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import type { VenueStaffMember } from "@/lib/types";

const initial: ActionState = {};

export function VenueStaffPanel({ venueId, staff }: { venueId: string; staff: VenueStaffMember[] }) {
  const [state, action, pending] = useActionState(setVenueStaffAction, initial);
  useActionToast(state);
  return (
    <section className="card-t mt-5 p-5">
      <h3 className="text-[16px] font-bold">Check-in staff</h3>
      <p className="mt-1 text-[12.5px] text-ink-soft">Staff can scan player passes and mark attendance for games at this venue. They need a Tempo account first.</p>
      <form action={action} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="venueId" value={venueId} />
        <input type="hidden" name="active" value="true" />
        <input name="handle" required placeholder="Staff Tempo handle, e.g. @sam" className="input-t min-w-0 flex-1" />
        <button type="submit" disabled={pending} className="btn-t btn-ghost-t !py-2.5 !text-[13px]">{pending ? "Adding..." : "Add staff"}</button>
      </form>
      {staff.length > 0 && (
        <ul className="mt-4 divide-y divide-white/8">
          {staff.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <span><b>{member.player?.fullName ?? "Tempo staff"}</b> <span className="text-ink-muted">@{member.player?.handle}</span></span>
              <form action={action}>
                <input type="hidden" name="venueId" value={venueId} />
                <input type="hidden" name="handle" value={member.player?.handle ?? ""} />
                <input type="hidden" name="active" value="false" />
                <button type="submit" className="text-[12px] font-semibold text-orange">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
