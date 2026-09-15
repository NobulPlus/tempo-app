"use client";

import { useActionState, useMemo, useState } from "react";
import { createGameAction, type ActionState } from "@/app/actions";
import {
  formatDayShort,
  formatNaira,
  formatRelativeDay,
  formatTime,
  splitKobo,
} from "@/lib/format";
import type { Slot } from "@/lib/types";
import {
  CalendarIcon,
  ClockIcon,
  PinIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { OptionRow } from "@/components/ui/option-row";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};

export interface HostSlotOption extends Slot {
  venueName: string;
  area: string;
  pitchName: string;
  size: string;
}

const LEVELS = [
  { key: "casual", label: "Casual", hint: "All levels. Nobody's counting." },
  { key: "intermediate", label: "Intermediate", hint: "Comfortable on the ball." },
  { key: "competitive", label: "Competitive", hint: "High tempo, serious players." },
] as const;

const TIME_BANDS = [
  { key: "all", label: "Any time" },
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
] as const;

export function HostForm({ slots }: { slots: HostSlotOption[] }) {
  const [state, action, pending] = useActionState(createGameAction, initial);
  useActionToast(state);

  const [slotId, setSlotId] = useState("");
  const [level, setLevel] = useState<string>("casual");
  const [capacity, setCapacity] = useState(10);
  const [minimum, setMinimum] = useState(8);
  const [dateKey, setDateKey] = useState("all");
  const [area, setArea] = useState("all");
  const [timeBand, setTimeBand] = useState("all");
  const [query, setQuery] = useState("");
  const [priceNaira, setPriceNaira] = useState<number | "">("");

  const slot = useMemo(() => slots.find((s) => s.id === slotId), [slots, slotId]);

  const areaOptions = useMemo(() => {
    return [...new Set(slots.map((s) => s.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [slots]);

  const calendarDays = useMemo(() => buildCalendarDays(slots), [slots]);

  const filteredSlots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slots.filter((s) => {
      const haystack = `${s.venueName} ${s.pitchName} ${s.area} ${s.size}`.toLowerCase();
      const matchesDate = dateKey === "all" || slotDateKey(s.startsAt) === dateKey;
      const matchesArea = area === "all" || s.area === area;
      const matchesTime = timeBand === "all" || slotTimeBand(s.startsAt) === timeBand;
      return matchesDate && matchesArea && matchesTime && (!q || haystack.includes(q));
    });
  }, [slots, dateKey, area, timeBand, query]);

  const groupedSlots = useMemo(() => {
    return filteredSlots.reduce<Record<string, HostSlotOption[]>>((map, s) => {
      const key = slotDateKey(s.startsAt);
      (map[key] ??= []).push(s);
      return map;
    }, {});
  }, [filteredSlots]);

  const suggested = useMemo(() => {
    if (!slot) return 0;
    const { each } = splitKobo(slot.priceKobo, Math.max(1, minimum));
    return Math.ceil(each / 50_000) * 50_000;
  }, [slot, minimum]);

  const effectivePrice = priceNaira === "" ? suggested / 100 : priceNaira;
  const projected = effectivePrice * 100 * capacity;
  const minimumCollection = effectivePrice * 100 * minimum;
  const covers = slot ? projected >= slot.priceKobo : false;
  const hostTotalKobo = slot ? slot.priceKobo + Math.round(slot.priceKobo * 0.05) : 0;
  const reimbursementTarget = slot ? Math.max(0, slot.priceKobo - minimumCollection) : 0;

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,.75fr)]">
      <div className="space-y-6">
        <section className="card-t overflow-hidden p-0">
          <div className="border-b border-white/10 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[.12em] text-green">Hosting board</p>
                <h2 className="mt-1 text-[22px] font-extrabold">Choose the best slot</h2>
                <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft">
                  Browse 30 days of venue availability, filter by area and time, then reserve the pitch for your game.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Open" value={String(slots.length)} />
                <MiniStat label="Shown" value={String(filteredSlots.length)} />
                <MiniStat label="Days" value={String(calendarDays.filter((d) => d.count > 0).length)} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_170px]">
              <label className="relative block">
                <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search venue, area or pitch"
                  className="w-full rounded-xl border border-white/12 bg-white/4 py-3 pl-9 pr-4 text-[14px] outline-none transition focus:border-green/50"
                />
              </label>
              <select
                value={area}
                onChange={(event) => setArea(event.target.value)}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3 text-[14px] outline-none transition focus:border-green/50"
              >
                <option value="all">All areas</option>
                {areaOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                value={timeBand}
                onChange={(event) => setTimeBand(event.target.value)}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-3 py-3 text-[14px] outline-none transition focus:border-green/50"
              >
                {TIME_BANDS.map((band) => (
                  <option key={band.key} value={band.key}>
                    {band.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[310px_1fr]">
            <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-bold">
                  <CalendarIcon size={15} className="text-green" />
                  Calendar
                </div>
                <button
                  type="button"
                  onClick={() => setDateKey("all")}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                    dateKey === "all"
                      ? "border-green/35 bg-green/14 text-green"
                      : "border-glass-border bg-glass text-ink-soft hover:text-ink"
                  }`}
                >
                  All
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <div key={`${day}-${index}`} className="py-1 text-center text-[10px] font-bold text-ink-muted">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => day.count > 0 && setDateKey(day.key)}
                    disabled={day.count === 0}
                    title={day.count > 0 ? `${day.count} open slots` : "No open slots"}
                    className={`min-h-[58px] rounded-xl border p-1.5 text-left transition ${
                      dateKey === day.key
                        ? "border-green/50 bg-green/14 text-green"
                        : day.count > 0
                          ? "border-white/10 bg-white/4 text-ink hover:border-green/35"
                          : "border-white/5 bg-transparent text-ink-muted opacity-45"
                    }`}
                  >
                    <span className="block text-[11px] font-bold">{day.day}</span>
                    {day.count > 0 && (
                      <>
                        <span className="mt-1 block text-[10px] text-ink-muted">{day.count} open</span>
                        <span className="block truncate text-[10px] font-semibold">{formatNaira(day.minPriceKobo, { compact: true })}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold">{dateKey === "all" ? "Open slots" : calendarDayTitle(dateKey)}</h3>
                  <p className="mt-0.5 text-[12px] text-ink-muted">Select one slot to lock the pitch deposit.</p>
                </div>
              </div>

              <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
                {slots.length === 0 && (
                  <EmptySlotState message="No open slots in the next 30 days. Generate availability from the venue dashboard first." />
                )}
                {slots.length > 0 && filteredSlots.length === 0 && (
                  <EmptySlotState message="No slots match your filters. Try another day, area or time." />
                )}
                {Object.entries(groupedSlots).map(([key, daySlots]) => (
                  <div key={key}>
                    {dateKey === "all" && (
                      <div className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-ink-muted">
                        {calendarDayTitle(key)}
                      </div>
                    )}
                    <div className="grid gap-2 md:grid-cols-2">
                      {daySlots.map((s) => (
                        <SlotCard key={s.id} slot={s} selected={slotId === s.id} onSelect={() => setSlotId(s.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <input type="hidden" name="slotId" value={slotId} />
        </section>

        <section className="card-t p-6">
          <h2 className="text-[18px] font-bold">Game details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="title" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Game name
              </label>
              <input
                id="title"
                name="title"
                required
                minLength={4}
                maxLength={60}
                placeholder="e.g. Tuesday Night Regulars"
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
              />
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                What should players know?
              </label>
              <textarea
                id="description"
                name="description"
                maxLength={600}
                rows={3}
                placeholder="Tell them the vibe, whether you provide bibs, what to bring..."
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-ink-soft">Level</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEVELS.map((l) => (
                  <OptionRow
                    key={l.key}
                    selected={level === l.key}
                    onClick={() => setLevel(l.key)}
                    label={l.label}
                    hint={l.hint}
                  />
                ))}
              </div>
              <input type="hidden" name="level" value={level} />
            </fieldset>

            <label className="flex items-center gap-3 text-[14px] text-ink-soft">
              <input type="checkbox" name="bibsProvided" className="h-4 w-4 accent-[#00e676]" />
              I&apos;ll bring bibs
            </label>
          </div>
        </section>

        <section className="card-t p-6">
          <h2 className="text-[18px] font-bold">Numbers and money</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField
              id="capacity"
              name="capacity"
              label="Total spots"
              min={4}
              max={30}
              value={capacity}
              onChange={(value) => {
                setCapacity(value);
                if (minimum > value) setMinimum(value);
              }}
            />

            <div>
              <NumberField
                id="minimumToGuarantee"
                name="minimumToGuarantee"
                label="Minimum to go ahead"
                min={2}
                max={capacity}
                value={minimum}
                onChange={setMinimum}
              />
              <p className="mt-1.5 text-[12px] text-ink-muted">Below this, you decide whether to go ahead or cancel.</p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="pricePerPlayerNaira" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Price per player
              </label>
              <div className="flex items-center rounded-xl border border-white/12 bg-white/4 px-4">
                <span className="text-[14px] font-bold text-ink-muted">₦</span>
                <input
                  id="pricePerPlayerNaira"
                  name="pricePerPlayerNaira"
                  type="number"
                  min={0}
                  step={500}
                  value={priceNaira === "" ? suggested / 100 : priceNaira}
                  onChange={(e) => setPriceNaira(Number(e.target.value))}
                  className="min-w-0 flex-1 bg-transparent py-3.5 pl-1 text-[15px] outline-none"
                />
              </div>
              {slot && (
                <p className={`mt-2 text-[12.5px] ${covers ? "text-ink-muted" : "text-orange"}`}>
                  {covers
                    ? `At ${capacity} players you'd collect ${formatNaira(projected)} against ${formatNaira(slot.priceKobo)} pitch hire.`
                    : `Careful: ${capacity} players at this price collects ${formatNaira(projected)}, but the pitch costs ${formatNaira(slot.priceKobo)}.`}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="card-t overflow-hidden p-0">
          <div className="border-b border-white/10 p-6">
            <p className="text-[12px] font-bold uppercase tracking-[.12em] text-green">Game preview</p>
            <h2 className="mt-1 text-[20px] font-extrabold">Your game</h2>
          </div>

          <div className="p-6">
            {slot ? (
              <div className="rounded-2xl border border-green/25 bg-green/8 p-4">
                <div className="text-[15px] font-bold">{slot.venueName}</div>
                <div className="mt-2 grid gap-2 text-[12.5px] text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <PinIcon size={14} />
                    {slot.area} · {slot.pitchName}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ClockIcon size={14} />
                    {formatRelativeDay(slot.startsAt)} · {formatTime(slot.startsAt)}-{formatTime(slot.endsAt)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-[13.5px] text-ink-muted">
                Pick a slot to see the game economics.
              </p>
            )}

            {slot && (
              <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/8 p-4 text-center">
                <div className="text-[12px] text-ink-muted">You pay now, from your wallet</div>
                <div className="mt-0.5 text-[24px] font-extrabold text-gold">{formatNaira(hostTotalKobo)}</div>
                <div className="mt-0.5 text-[11.5px] text-ink-muted">
                  {formatNaira(slot.priceKobo)} pitch hire + 5% service fee
                </div>
              </div>
            )}

            <dl className="mt-5 space-y-3 text-[14px]">
              <Row label="Per player" value={effectivePrice ? formatNaira(effectivePrice * 100) : "-"} />
              <Row label={`If ${minimum} join`} value={effectivePrice ? formatNaira(minimumCollection) : "-"} />
              <Row label={`If all ${capacity} join`} value={effectivePrice ? formatNaira(projected) : "-"} strong />
            </dl>

            {slot && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 p-4">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-bold">
                  <WalletIcon size={15} className="text-green" />
                  Host economics
                </div>
                <div className="space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
                  <p className="flex items-start gap-2">
                    <UsersIcon size={14} className="mt-0.5 shrink-0 text-green" />
                    You&apos;re counted as the first player automatically.
                  </p>
                  <p className="flex items-start gap-2">
                    <ShieldIcon size={14} className="mt-0.5 shrink-0 text-green" />
                    Player payments reimburse your wallet up to what you paid for the pitch.
                  </p>
                  {reimbursementTarget > 0 && (
                    <p className="text-orange">
                      At the minimum headcount, you would still be short by {formatNaira(reimbursementTarget)}.
                    </p>
                  )}
                </div>
              </div>
            )}

            <button type="submit" disabled={pending || !slotId} className="btn-t btn-green-t mt-5 w-full">
              {pending ? "Reserving..." : slot ? `Pay ${formatNaira(hostTotalKobo)} & publish` : "Publish game"}
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}

function SlotCard({
  slot,
  selected,
  onSelect,
}: {
  slot: HostSlotOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-2xl border p-4 text-left transition ${
        selected ? "glow-brand border-green/50 bg-green/10" : "border-white/10 bg-white/4 hover:border-green/35"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold">{slot.venueName}</div>
          <div className="mt-0.5 truncate text-[12px] text-ink-muted">
            {slot.area} · {slot.pitchName}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[14px] font-extrabold">{formatTime(slot.startsAt)}</div>
          <div className="text-[11px] text-ink-muted">{formatTime(slot.endsAt)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
        <span className="text-[12px] text-ink-muted">{slot.size}</span>
        <span className="text-[14px] font-extrabold text-green">{formatNaira(slot.priceKobo)}</span>
      </div>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass px-4 py-3">
      <div className="text-[17px] font-extrabold">{value}</div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-ink-muted">{label}</div>
    </div>
  );
}

function EmptySlotState({ message }: { message: string }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-white/4 p-6 text-center text-[14px] text-ink-soft">
      {message}
    </p>
  );
}

function NumberField({
  id,
  name,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
      />
    </div>
  );
}

function buildCalendarDays(slots: HostSlotOption[]) {
  const byDay = new Map<string, { count: number; minPriceKobo: number }>();
  for (const slot of slots) {
    const key = slotDateKey(slot.startsAt);
    const current = byDay.get(key);
    byDay.set(key, {
      count: (current?.count ?? 0) + 1,
      minPriceKobo: Math.min(current?.minPriceKobo ?? slot.priceKobo, slot.priceKobo),
    });
  }

  const first = slots[0]?.startsAt ? new Date(slots[0].startsAt) : new Date();
  const offset = (lagosWeekday(first) + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 35 }, (_, index) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + index);
    const key = slotDateKey(dayDate.toISOString());
    const info = byDay.get(key);
    return {
      key,
      day: lagosDayNumber(dayDate),
      count: info?.count ?? 0,
      minPriceKobo: info?.minPriceKobo ?? 0,
    };
  });
}

function slotDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function calendarDayTitle(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return formatDayShort(new Date(Date.UTC(year, month - 1, day, 12)).toISOString());
}

function lagosDayNumber(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric" }).format(date);
}

function lagosWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function slotTimeBand(iso: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-white/10 pt-3 font-extrabold" : ""}`}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
