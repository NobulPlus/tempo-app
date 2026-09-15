"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitVenueOwnerApplicationAction, type ActionState } from "@/app/actions";
import { BuildingIcon, CheckIcon, ClockIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";
import { Field, TextAreaField } from "@/components/ui/field";
import { LagosAreaField } from "@/components/venue/lagos-area-field";
import type { VenueOwnerApplication } from "@/lib/types";

const initial: ActionState = {};

const STATUS_STYLE: Record<VenueOwnerApplication["status"], string> = {
  pending: "!border-gold/35 !bg-gold/12 !text-gold",
  approved: "!border-green/35 !bg-green/12 !text-green",
  rejected: "!border-orange/35 !bg-orange/12 !text-orange",
};

export function VenueOwnerApplicationForm({
  application,
  hasAccess = false,
}: {
  application: VenueOwnerApplication | null;
  hasAccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitVenueOwnerApplicationAction, initial);
  useActionToast(state);

  const current = hasAccess ? "approved" : state.ok ? "pending" : application?.status;

  if (current) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-glass-border bg-glass p-5 text-left">
        <div className="flex items-center gap-2">
          <span className={`chip-t ${STATUS_STYLE[current]}`}>
            {current === "pending" ? <ClockIcon size={12} /> : <CheckIcon size={12} />}
            {current[0].toUpperCase() + current.slice(1)}
          </span>
          <h3 className="text-[16px] font-bold">Venue owner application</h3>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
          {current === "approved"
            ? "Your venue owner access is approved. You can now create and manage venues."
            : current === "rejected"
              ? application?.reviewNote || "This application was not approved. Contact Tempo if you think this needs another look."
              : "Your application is waiting for admin review. Once approved, your account will unlock the venue dashboard."}
        </p>
        {current === "approved" && (
          <Link href="/venue" className="btn-t btn-green-t mt-5 w-full">
            Open venue dashboard
          </Link>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-xl space-y-4 text-left">
      <Field label="Venue name" name="venueName" required placeholder="e.g. The Yard, Lekki" />
      <LagosAreaField />
      <Field label="Venue address" name="address" required placeholder="Street address in Lagos" />
      <Field label="Contact phone" name="phone" type="tel" placeholder="0801 234 5678" />
      <TextAreaField
        label="What should Tempo know?"
        name="notes"
        rows={4}
        maxLength={800}
        placeholder="Tell us your role, number of spaces, operating hours, or anything useful for verification."
      />

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full !py-3.5">
        <BuildingIcon size={16} />
        {pending ? "Submitting..." : "Apply for venue owner access"}
      </button>

      <p className="text-center text-[12px] leading-relaxed text-ink-muted">
        Approval grants access to create venues, spaces, availability and booking operations.
      </p>
    </form>
  );
}
