"use client";

import { useState, useTransition } from "react";
import { dismissWaitlistLeadAction } from "@/app/actions";
import { formatRelativeDay } from "@/lib/format";
import { CheckIcon, BuildingIcon, PinIcon, UsersIcon } from "@/components/icons";
import type { WaitlistLead } from "@/lib/types";

export function LeadRow({ lead }: { lead: WaitlistLead }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gone) return null;

  const dismiss = () => {
    start(async () => {
      const result = await dismissWaitlistLeadAction(lead.id);
      if (result.ok) setGone(true);
      else setError(result.error ?? "Couldn't dismiss that.");
    });
  };

  return (
    <div className="card-t flex flex-wrap items-center gap-3 p-3.5">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${
          lead.role === "venue_owner"
            ? "border-gold/35 bg-gold/12 text-gold"
            : "border-green/35 bg-green/10 text-green"
        }`}
      >
        {lead.role === "venue_owner" ? <BuildingIcon size={16} /> : <UsersIcon size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-semibold">{lead.email ?? lead.phone}</span>
          <span
            className={`chip-t !px-2 !py-1 !text-[11px] ${
              lead.role === "venue_owner"
                ? "!border-gold/35 !bg-gold/12 !text-gold"
                : "!border-green/35 !bg-green/12 !text-green"
            }`}
          >
            {lead.role === "venue_owner" ? "Partner" : "Player"}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <PinIcon size={12} />
            {lead.area ?? "No area given"}
          </span>
          <span>{formatRelativeDay(lead.createdAt)}</span>
        </div>
      </div>
      {error && <p className="text-[12px] text-orange">{error}</p>}
      <button
        onClick={dismiss}
        disabled={pending}
        className="btn-t btn-ghost-t !px-3 !py-2 !text-[12px]"
      >
        <CheckIcon size={13} />
        {pending ? "Working…" : "Dismiss"}
      </button>
    </div>
  );
}
