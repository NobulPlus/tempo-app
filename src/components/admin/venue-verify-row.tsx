"use client";

import { useActionState, useState } from "react";
import { verifyVenueAction, type ActionState } from "@/app/actions";
import { ShieldIcon, PinIcon, ClockIcon, PhoneIcon, ChevronDownIcon } from "@/components/icons";
import { formatRelativeDay } from "@/lib/format";
import type { Venue, VenueVerificationEvent } from "@/lib/types";

const initial: ActionState = {};

export function VenueVerifyRow({ venue, history }: { venue: Venue; history: VenueVerificationEvent[] }) {
  const [state, formAction, pending] = useActionState(verifyVenueAction, initial);
  const [note, setNote] = useState(venue.verificationNote ?? "");
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="card-t overflow-hidden p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-bold">{venue.name}</h3>
            <span
              className={`chip-t ${
                venue.verified
                  ? "!border-green/35 !bg-green/12 !text-green"
                  : "!border-gold/35 !bg-gold/12 !text-gold"
              }`}
            >
              <ShieldIcon size={11} />
              {venue.verified ? "Verified" : "Needs review"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon size={13} />
              {venue.area} · {venue.side}
            </span>
            {venue.phone && (
              <span className="inline-flex items-center gap-1.5">
                <PhoneIcon size={13} />
                {venue.phone}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 truncate text-[12.5px] text-ink-muted">
            <PinIcon size={13} />
            {venue.address}
          </div>
          {venue.verified && venue.verifiedAt && (
            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-muted">
              <ClockIcon size={12} />
              Verified {formatRelativeDay(venue.verifiedAt)}
              {venue.verifiedByName && ` by ${venue.verifiedByName}`}
            </div>
          )}
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-[12px] font-semibold text-ink-muted transition hover:text-ink"
            >
              <ChevronDownIcon size={12} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
              {history.length} verification event{history.length === 1 ? "" : "s"}
            </button>
          )}
          {showHistory && (
            <ul className="mt-2 space-y-1.5 border-l border-glass-border pl-3">
              {history.map((e) => (
                <li key={e.id} className="text-[12px] text-ink-muted">
                  <span className={e.verified ? "text-green" : "text-orange"}>
                    {e.verified ? "Verified" : "Unverified"}
                  </span>{" "}
                  by {e.adminName} · {formatRelativeDay(e.createdAt)}
                  {e.note && <span className="block text-ink-soft">&ldquo;{e.note}&rdquo;</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex max-w-full flex-wrap gap-1.5 sm:max-w-[310px] sm:justify-end">
          {venue.amenities.slice(0, 4).map((amenity) => (
            <span key={amenity} className="chip-t !px-2 !py-1 !text-[11px]">
              {amenity}
            </span>
          ))}
          {venue.amenities.length > 4 && (
            <span className="chip-t !px-2 !py-1 !text-[11px]">+{venue.amenities.length - 4}</span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-glass-border bg-glass p-3 text-[12.5px] text-ink-soft md:grid-cols-[1fr_auto]">
        <p>{venue.description || "No public description added yet."}</p>
        <span className="font-semibold text-ink-muted">
          {venue.photos.length} photo{venue.photos.length === 1 ? "" : "s"}
        </span>
      </div>

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="venueId" value={venue.id} />
        <input
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Verification note (optional)"
          className="min-w-0 flex-1 rounded-lg border border-glass-border bg-glass px-3.5 py-2.5 text-[13.5px] outline-none transition focus:border-green/50"
        />
        {venue.verified ? (
          <button
            type="submit"
            name="verified"
            value="false"
            disabled={pending}
            className="btn-t btn-ghost-t !px-4 !py-2.5 !text-[13px]"
          >
            {pending ? "Working…" : "Unverify"}
          </button>
        ) : (
          <button
            type="submit"
            name="verified"
            value="true"
            disabled={pending}
            className="btn-t btn-green-t !px-4 !py-2.5 !text-[13px]"
          >
            {pending ? "Working…" : "Verify"}
          </button>
        )}
      </form>

      {state.error && <p className="mt-2 text-[12.5px] text-orange">{state.error}</p>}
    </div>
  );
}
