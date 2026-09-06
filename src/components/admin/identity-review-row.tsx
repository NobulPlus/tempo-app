"use client";

import { useActionState, useState } from "react";
import { reviewIdentityVerificationAction, type ActionState } from "@/app/actions";
import { ShieldIcon, DocumentIcon, ClockIcon } from "@/components/icons";
import { formatRelativeDay } from "@/lib/format";
import type { IdentityVerification } from "@/lib/types";

const initial: ActionState = {};

const STATUS_STYLE: Record<IdentityVerification["status"], string> = {
  pending: "!border-gold/35 !bg-gold/12 !text-gold",
  approved: "!border-green/35 !bg-green/12 !text-green",
  rejected: "!border-orange/35 !bg-orange/12 !text-orange",
};

export function IdentityReviewRow({
  verification,
  documentUrl,
}: {
  verification: IdentityVerification;
  documentUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(reviewIdentityVerificationAction, initial);
  const [note, setNote] = useState(verification.reviewNote ?? "");

  return (
    <div className="card-t overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold">{verification.submitter?.fullName ?? "Unknown"}</h3>
            <span className={`chip-t ${STATUS_STYLE[verification.status]}`}>
              <ShieldIcon size={11} />
              {verification.status[0].toUpperCase() + verification.status.slice(1)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
            {verification.submitter && <span>@{verification.submitter.handle}</span>}
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <ClockIcon size={12} />
              Submitted {formatRelativeDay(verification.createdAt)}
            </span>
          </div>
        </div>

        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-t btn-ghost-t !px-3.5 !py-2 !text-[13px]"
          >
            <DocumentIcon size={15} />
            View document
          </a>
        ) : (
          <span className="text-[12.5px] text-ink-muted">Document unavailable</span>
        )}
      </div>

      {verification.status !== "pending" && verification.reviewNote && (
        <p className="mt-3 rounded-lg border border-glass-border bg-glass px-3.5 py-2.5 text-[13px] text-ink-soft">
          &ldquo;{verification.reviewNote}&rdquo;
        </p>
      )}

      {verification.status === "pending" && (
        <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="verificationId" value={verification.id} />
          <input
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
            {pending ? "Working…" : "Reject"}
          </button>
          <button
            type="submit"
            name="approve"
            value="true"
            disabled={pending}
            className="btn-t btn-green-t !px-4 !py-2.5 !text-[13px]"
          >
            {pending ? "Working…" : "Approve"}
          </button>
        </form>
      )}

      {state.error && <p className="mt-2 text-[12.5px] text-orange">{state.error}</p>}
    </div>
  );
}
