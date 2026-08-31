"use client";

import { useMemo, useState } from "react";
import { LeadRow } from "@/components/admin/lead-row";
import { BuildingIcon, PinIcon, SearchIcon, UsersIcon } from "@/components/icons";
import type { WaitlistLead } from "@/lib/types";

type LeadType = "all" | "partner" | "player";

const TYPES: { value: LeadType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "partner", label: "Partners" },
  { value: "player", label: "Players" },
];

export function LeadBoard({ leads }: { leads: WaitlistLead[] }) {
  const [type, setType] = useState<LeadType>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const partner = lead.role === "venue_owner";
      if (type === "partner" && !partner) return false;
      if (type === "player" && partner) return false;
      if (q) {
        const hay = `${lead.email ?? ""} ${lead.phone ?? ""} ${lead.area ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [leads, q, type]);

  const partners = leads.filter((lead) => lead.role === "venue_owner");
  const players = leads.filter((lead) => lead.role !== "venue_owner");
  const areaDemand = Array.from(
    leads.reduce((map, lead) => {
      const area = lead.area?.trim() || "No area";
      map.set(area, (map.get(area) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<BuildingIcon size={14} />} label="Partner leads" value={partners.length} />
        <Stat icon={<UsersIcon size={14} />} label="Player leads" value={players.length} />
        <Stat icon={<PinIcon size={14} />} label="Areas named" value={areaDemand.length} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="card-t p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                  <SearchIcon size={15} />
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search contact or area"
                  className="w-full rounded-full border border-glass-border bg-glass py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition focus:border-green/50"
                />
              </div>
              <Segmented value={type} onChange={setType} />
            </div>
            <div className="mt-3 text-[12.5px] text-ink-muted">
              Showing {filtered.length} of {leads.length} leads
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {filtered.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
            {filtered.length === 0 && (
              <div className="card-t p-8 text-center text-[14px] text-ink-soft">
                No leads match those filters.
              </div>
            )}
          </div>
        </div>

        <aside className="card-t self-start overflow-hidden">
          <div className="border-b border-glass-border p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.9px] text-ink-muted">
              <PinIcon size={14} />
              Launch demand
            </div>
            <h2 className="mt-2 text-[18px] font-bold">Top areas</h2>
          </div>
          <div className="space-y-3 p-4">
            {areaDemand.slice(0, 8).map(([area, count]) => (
              <div key={area}>
                <div className="mb-1 flex justify-between gap-3 text-[12.5px]">
                  <span className="truncate font-semibold">{area}</span>
                  <span className="shrink-0 text-ink-muted">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-glass">
                  <div
                    className="h-2 rounded-full bg-green"
                    style={{
                      width: `${Math.max(16, (count / Math.max(1, areaDemand[0]?.[1] ?? count)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {areaDemand.length === 0 && (
              <p className="text-[14px] text-ink-soft">No areas to rank yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Segmented({ value, onChange }: { value: LeadType; onChange: (value: LeadType) => void }) {
  return (
    <div className="flex shrink-0 rounded-full border border-glass-border bg-glass p-1" aria-label="Lead type">
      {TYPES.map((option) => (
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

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="card-t p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[.7px] text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[28px] font-extrabold tabular-nums">{value}</div>
    </div>
  );
}
