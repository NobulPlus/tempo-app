"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { VenueOwnerApplicationRow } from "@/components/admin/venue-owner-application-row";
import type { ApplicationStatus, VenueOwnerApplication } from "@/lib/types";

type Status = ApplicationStatus | "all";

const STATUS: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function VenueOwnerApplicationBoard({
  applications,
}: {
  applications: VenueOwnerApplication[];
}) {
  const [status, setStatus] = useState<Status>("pending");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return applications.filter((application) => {
      if (status !== "all" && application.status !== status) return false;
      if (q) {
        const hay = `${application.venueName} ${application.area} ${application.address} ${application.applicant?.fullName ?? ""} ${application.applicant?.handle ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [applications, q, status]);

  const pending = applications.filter((application) => application.status === "pending").length;
  const approved = applications.filter((application) => application.status === "approved").length;
  const rejected = applications.filter((application) => application.status === "rejected").length;

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pending" value={pending} tone={pending ? "text-gold" : "text-green"} />
        <Stat label="Approved" value={approved} tone="text-green" />
        <Stat label="Rejected" value={rejected} />
      </div>

      <div className="card-t mt-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <SearchIcon size={15} />
            </span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search applicant, venue or area"
              className="w-full rounded-full border border-glass-border bg-glass py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition focus:border-green/50"
            />
          </div>
          <div className="flex shrink-0 flex-wrap rounded-full border border-glass-border bg-glass p-1">
            {STATUS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                  status === option.value ? "bg-green text-[#051530]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 text-[12.5px] text-ink-muted">
          Showing {filtered.length} of {applications.length} applications
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((application) => (
          <VenueOwnerApplicationRow key={application.id} application={application} />
        ))}
        {filtered.length === 0 && (
          <div className="card-t p-8 text-center text-[14px] text-ink-soft">No applications match those filters.</div>
        )}
      </div>
    </section>
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
