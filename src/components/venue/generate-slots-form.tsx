"use client";

import { useMemo, useState, useActionState } from "react";
import { generateSlotsAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

const DAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];

type RuleDraft = {
  id: string;
  name: string;
  enabled: boolean;
  days: string[];
  openTime: string;
  closeTime: string;
  basePrice: number;
  peakStart: string;
  peakEnd: string;
  peakPrice: number | "";
};

const DEFAULT_RULES: RuleDraft[] = [
  {
    id: "weekdays",
    name: "Weekdays",
    enabled: true,
    days: ["1", "2", "3", "4", "5"],
    openTime: "08:00",
    closeTime: "22:00",
    basePrice: 30000,
    peakStart: "17:00",
    peakEnd: "21:00",
    peakPrice: 40000,
  },
  {
    id: "saturday",
    name: "Saturday",
    enabled: true,
    days: ["6"],
    openTime: "07:00",
    closeTime: "23:00",
    basePrice: 35000,
    peakStart: "16:00",
    peakEnd: "21:00",
    peakPrice: 45000,
  },
  {
    id: "sunday",
    name: "Sunday",
    enabled: true,
    days: ["0"],
    openTime: "10:00",
    closeTime: "20:00",
    basePrice: 30000,
    peakStart: "",
    peakEnd: "",
    peakPrice: "",
  },
];

export function GenerateSlotsForm({ pitchId, basePriceKobo }: { pitchId: string; basePriceKobo: number }) {
  const [state, formAction, pending] = useActionState(generateSlotsAction, initial);
  useActionToast(state);

  const [rules, setRules] = useState(() =>
    DEFAULT_RULES.map((rule) => ({ ...rule, basePrice: Math.round(basePriceKobo / 100) || rule.basePrice })),
  );
  const [slotDuration, setSlotDuration] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [daysAhead, setDaysAhead] = useState(30);

  const preview = useMemo(
    () => estimateSlots(rules, slotDuration, bufferMinutes, daysAhead),
    [rules, slotDuration, bufferMinutes, daysAhead],
  );

  const updateRule = (id: string, patch: Partial<RuleDraft>) => {
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const toggleDay = (ruleId: string, day: string) => {
    setRules((current) =>
      current.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const days = rule.days.includes(day)
          ? rule.days.filter((value) => value !== day)
          : [...rule.days, day].sort((a, b) => Number(a) - Number(b));
        return { ...rule, days };
      }),
    );
  };

  return (
    <form action={formAction} className="card-t space-y-5 p-6">
      <input type="hidden" name="pitchId" value={pitchId} />
      <input type="hidden" name="slotDurationMinutes" value={slotDuration} />
      <input type="hidden" name="bufferMinutes" value={bufferMinutes} />
      <input type="hidden" name="daysAhead" value={daysAhead} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-[16px] font-bold">Generate availability</h3>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-soft">
            Create the next set of bookable slots from weekly operating rules. Existing bookings and blocked times stay untouched.
          </p>
        </div>
        <div className="rounded-2xl border border-green/25 bg-green/8 px-4 py-3 text-[13px] text-green">
          <div className="font-bold">{preview.total} estimated slots</div>
          <div className="mt-0.5 text-[12px] opacity-85">Before conflict checks</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <CompactNumberField
          label="Slot length"
          value={slotDuration}
          min={30}
          max={240}
          step={15}
          suffix="mins"
          onChange={setSlotDuration}
        />
        <CompactNumberField
          label="Buffer between bookings"
          value={bufferMinutes}
          min={0}
          max={120}
          step={5}
          suffix="mins"
          onChange={setBufferMinutes}
        />
        <CompactNumberField
          label="Generate for"
          value={daysAhead}
          min={1}
          max={60}
          step={1}
          suffix="days"
          onChange={setDaysAhead}
        />
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-2xl border border-glass-border bg-white/[0.03] p-4">
            <input type="hidden" name="ruleIndex" value={rule.id} />
            <input type="hidden" name={`ruleEnabled-${rule.id}`} value={rule.enabled ? "true" : "false"} />
            <input type="hidden" name={`ruleName-${rule.id}`} value={rule.name} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                  className="h-4 w-4 accent-green"
                />
                <span>
                  <span className="block text-[14px] font-bold text-ink">{rule.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {rule.enabled ? `${rule.days.length} active day${rule.days.length === 1 ? "" : "s"}` : "Not generating"}
                  </span>
                </span>
              </label>
              <div className="text-[12px] text-ink-muted">
                {rule.enabled ? `${formatNaira(rule.basePrice)} base${rule.peakPrice ? ` / ${formatNaira(rule.peakPrice)} peak` : ""}` : "Disabled"}
              </div>
            </div>

            {rule.enabled && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 text-[12px] font-semibold text-ink-muted">Active days</div>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <label key={day.value} className="chip-t cursor-pointer">
                        <input
                          type="checkbox"
                          name={`daysOfWeek-${rule.id}`}
                          value={day.value}
                          checked={rule.days.includes(day.value)}
                          onChange={() => toggleDay(rule.id, day.value)}
                          className="h-3.5 w-3.5 accent-green"
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TimeField label="Opens" name={`openTime-${rule.id}`} value={rule.openTime} onChange={(openTime) => updateRule(rule.id, { openTime })} />
                  <TimeField label="Closes" name={`closeTime-${rule.id}`} value={rule.closeTime} onChange={(closeTime) => updateRule(rule.id, { closeTime })} />
                  <MoneyField
                    label="Base price"
                    name={`basePriceNaira-${rule.id}`}
                    value={rule.basePrice}
                    onChange={(basePrice) => updateRule(rule.id, { basePrice: basePrice === "" ? 0 : basePrice })}
                  />
                  <MoneyField label="Peak price" name={`peakPriceNaira-${rule.id}`} value={rule.peakPrice} onChange={(peakPrice) => updateRule(rule.id, { peakPrice })} optional />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <TimeField label="Peak starts" name={`peakStartTime-${rule.id}`} value={rule.peakStart} onChange={(peakStart) => updateRule(rule.id, { peakStart })} optional />
                  <TimeField label="Peak ends" name={`peakEndTime-${rule.id}`} value={rule.peakEnd} onChange={(peakEnd) => updateRule(rule.id, { peakEnd })} optional />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-glass-border bg-glass p-4">
        <div className="grid gap-3 text-[13px] text-ink-soft sm:grid-cols-3">
          <SummaryStat label="Rules active" value={String(preview.rulesActive)} />
          <SummaryStat label="Days covered" value={String(preview.daysCovered)} />
          <SummaryStat label="Conflicts" value="Skipped safely" />
        </div>
      </div>

      <button type="submit" disabled={pending || preview.total === 0} className="btn-t btn-green-t !py-3 !text-[14px]">
        {pending ? "Generating..." : "Generate slots"}
      </button>
    </form>
  );
}

function CompactNumberField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-ink-muted">{label}</span>
      <span className="flex items-center rounded-xl border border-glass-border bg-[#0d1412] px-3">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent py-3 text-[14px] font-semibold text-ink outline-none"
        />
        <span className="text-[12px] text-ink-muted">{suffix}</span>
      </span>
    </label>
  );
}

function TimeField({
  label,
  name,
  value,
  optional = false,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-ink-muted">{label}</span>
      <input
        name={name}
        type="time"
        required={!optional}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-compact-t"
      />
    </label>
  );
}

function MoneyField({
  label,
  name,
  value,
  optional = false,
  onChange,
}: {
  label: string;
  name: string;
  value: number | "";
  optional?: boolean;
  onChange: (value: number | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-ink-muted">{label}</span>
      <span className="flex items-center rounded-xl border border-glass-border bg-[#0d1412] px-3">
        <span className="text-[13px] font-bold text-ink-muted">₦</span>
        <input
          name={name}
          type="number"
          min={optional ? 0 : 500}
          max={500000}
          step={500}
          required={!optional}
          value={value}
          onChange={(event) => onChange(event.target.value ? Number(event.target.value) : "")}
          className="min-w-0 flex-1 bg-transparent py-3 pl-1 text-[14px] font-semibold text-ink outline-none"
        />
      </span>
    </label>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase text-ink-muted">{label}</div>
      <div className="mt-0.5 text-[14px] font-bold text-ink">{value}</div>
    </div>
  );
}

function estimateSlots(
  rules: RuleDraft[],
  slotDuration: number,
  bufferMinutes: number,
  daysAhead: number,
): { total: number; rulesActive: number; daysCovered: number } {
  const active = rules.filter((rule) => rule.enabled && rule.days.length > 0);
  const interval = slotDuration + bufferMinutes;
  if (interval <= 0) return { total: 0, rulesActive: active.length, daysCovered: 0 };

  let total = 0;
  const covered = new Set<string>();
  const today = new Date();
  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    const dow = String(day.getDay());
    for (const rule of active) {
      if (!rule.days.includes(dow)) continue;
      const open = timeToMinutes(rule.openTime);
      const close = timeToMinutes(rule.closeTime);
      if (open === null || close === null || open >= close) continue;
      total += Math.max(0, Math.floor((close - open - slotDuration) / interval) + 1);
      covered.add(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`);
    }
  }

  return { total, rulesActive: active.length, daysCovered: covered.size };
}

function timeToMinutes(value: string): number | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatNaira(value: number | ""): string {
  if (value === "") return "no";
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}
