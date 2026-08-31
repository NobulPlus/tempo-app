"use client";

import { useMemo, useState } from "react";
import { SearchIcon, ShieldIcon } from "@/components/icons";
import { VenueVerifyRow } from "@/components/admin/venue-verify-row";
import type { Venue } from "@/lib/types";

type Status = "pending" | "verified" | "all";
type Side = "all" | "island" | "mainland";

const STATUS: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "all", label: "All" },
];

const SIDES: { value: Side; label: string }[] = [
  { value: "all", label: "All Lagos" },
  { value: "island", label: "Island" },
  { value: "mainland", label: "Mainland" },
];

export function VenueVerificationBoard({ venues }: { venues: Venue[] }) {
  const [status, setStatus] = useState<Status>("pending");
  const [side, setSide] = useState<Side>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return venues
      .filter((venue) => {
        if (status === "pending" && venue.verified) return false;
        if (status === "verified" && !venue.verified) return false;
        if (side !== "all" && venue.side !== side) return false;
        if (q) {
          const hay = `${venue.name} ${venue.area} ${venue.address}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => Number(a.verified) - Number(b.verified) || a.area.localeCompare(b.area));
  }, [venues, status, side, q]);

  const pending = venues.filter((v) => !v.verified).length;
  const verified = venues.length - pending;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pending review" value={pending} tone={pending ? "text-gold" : "text-green"} />
        <Stat label="Verified supply" value={verified} />
        <Stat label="Areas covered" value={new Set(venues.map((v) => v.area)).size} />
      </div>

      <div className="mt-6 card-t p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <SearchIcon size={15} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search venues, areas or addresses"
              className="w-full rounded-full border border-glass-border bg-glass py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition focus:border-green/50"
            />
          </div>
          <Segmented
            label="Verification status"
            value={status}
            options={STATUS}
            onChange={(next) => setStatus(next as Status)}
          />
          <Segmented
            label="Lagos side"
            value={side}
            options={SIDES}
            onChange={(next) => setSide(next as Side)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-muted">
          <ShieldIcon size={13} />
          Showing {filtered.length} of {venues.length} venue{venues.length === 1 ? "" : "s"}
          {status !== "all" && <span className="chip-t !py-1 capitalize">{status}</span>}
          {side !== "all" && <span className="chip-t !py-1 capitalize">{side}</span>}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((venue) => (
          <VenueVerifyRow key={venue.id} venue={venue} />
        ))}
        {filtered.length === 0 && (
          <div className="card-t p-8 text-center text-[14px] text-ink-soft">
            No venues match those filters.
          </div>
        )}
      </div>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-full border border-glass-border bg-glass p-1" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
            value === option.value ? "bg-green text-[#051530]" : "text-ink-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card-t p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[.7px] text-ink-muted">{label}</div>
      <div className={`mt-1 text-[28px] font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
