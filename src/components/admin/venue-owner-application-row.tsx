"use client";

import { useActionState, useState } from "react";
import { reviewVenueOwnerApplicationAction, type ActionState } from "@/app/actions";
import { BuildingIcon, CheckIcon, ClockIcon, PinIcon } from "@/components/icons";
import { formatRelativeDay } from "@/lib/format";
import type { VenueOwnerApplication } from "@/lib/types";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

const STATUS_STYLE: Record<VenueOwnerApplication["status"], string> = {
  pending: "!border-gold/35 !bg-gold/12 !text-gold",
  approved: "!border-green/35 !bg-green/12 !text-green",
  rejected: "!border-orange/35 !bg-orange/12 !text-orange",
};

export function VenueOwnerApplicationRow({
  application,
}: {
  application: VenueOwnerApplication;
}) {
  const [state, formAction, pending] = useActionState(reviewVenueOwnerApplicationAction, initial);
  useActionToast(state);
  const [note, setNote] = useState(application.reviewNote ?? "");

  return (
    <div className="card-t overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold">{application.venueName}</h3>
            <span className={`chip-t ${STATUS_STYLE[application.status]}`}>
              {application.status === "pending" ? <ClockIcon size={11} /> : <CheckIcon size={11} />}
              {application.status[0].toUpperCase() + application.status.slice(1)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <BuildingIcon size={12} />
              {application.applicant?.fullName ?? "Unknown applicant"}
              {application.applicant?.handle ? ` (@${application.applicant.handle})` : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <PinIcon size={12} />
              {application.area}
            </span>
            <span className="text-ink-muted">Submitted {formatRelativeDay(application.createdAt)}</span>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">{application.address}</p>
          {application.phone && <p className="mt-1 text-[13px] text-ink-muted">{application.phone}</p>}
          {application.notes && (
            <p className="mt-3 rounded-lg border border-glass-border bg-glass px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
              {application.notes}
            </p>
          )}
        </div>
      </div>

      {application.status !== "pending" && application.reviewNote && (
        <p className="mt-3 rounded-lg border border-glass-border bg-glass px-3.5 py-2.5 text-[13px] text-ink-soft">
          {application.reviewNote}
        </p>
      )}

      {application.status === "pending" && (
        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="applicationId" value={application.id} />
          <input
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Review note (optional)"
            className="min-w-0 flex-1 rounded-lg border border-glass-border bg-glass px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-green/50"
          />
          <button
            type="submit"
            name="approve"
            value="false"
            disabled={pending}
            className="btn-t btn-ghost-t !border-orange/40 !px-4 !py-2.5 !text-[13px] !text-orange"
          >
            {pending ? "Working..." : "Reject"}
          </button>
          <button
            type="submit"
            name="approve"
            value="true"
            disabled={pending}
            className="btn-t btn-green-t !px-4 !py-2.5 !text-[13px]"
          >
            {pending ? "Working..." : "Approve access"}
          </button>
        </form>
      )}
    </div>
  );
}
