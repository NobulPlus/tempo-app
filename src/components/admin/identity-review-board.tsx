"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { IdentityReviewRow } from "@/components/admin/identity-review-row";
import type { IdentityVerification } from "@/lib/types";

type Status = "pending" | "approved" | "rejected" | "all";

const STATUS: { value: Status; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function IdentityReviewBoard({
  verifications,
  documentUrls,
}: {
  verifications: IdentityVerification[];
  documentUrls: Record<string, string | null>;
}) {
  const [status, setStatus] = useState<Status>("pending");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return verifications
      .filter((v) => {
        if (status !== "all" && v.status !== status) return false;
        if (q) {
          const hay = `${v.submitter?.fullName ?? ""} ${v.submitter?.handle ?? ""}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [verifications, status, q]);

  const pending = verifications.filter((v) => v.status === "pending").length;
  const approved = verifications.filter((v) => v.status === "approved").length;
  const rejected = verifications.filter((v) => v.status === "rejected").length;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Pending" value={pending} tone={pending ? "text-gold" : "text-green"} />
        <Stat label="Approved" value={approved} tone="text-green" />
        <Stat label="Rejected" value={rejected} />
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
              placeholder="Search by name or handle"
              className="w-full rounded-full border border-glass-border bg-glass py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition focus:border-green/50"
            />
          </div>
          <div className="flex shrink-0 flex-wrap rounded-full border border-glass-border bg-glass p-1">
            {STATUS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                  status === s.value ? "bg-green text-[#051530]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((v) => (
          <IdentityReviewRow key={v.id} verification={v} documentUrl={documentUrls[v.id] ?? null} />
        ))}
        {filtered.length === 0 && (
          <div className="card-t p-8 text-center text-[14px] text-ink-soft">No submissions match those filters.</div>
        )}
      </div>
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
