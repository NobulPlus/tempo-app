"use client";

import { useActionState, useMemo, useState } from "react";
import { createGameAction, type ActionState } from "@/app/actions";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { splitKobo } from "@/lib/format";
import type { Slot } from "@/lib/types";
import { CheckIcon, UsersIcon, ShieldIcon } from "@/components/icons";

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

export function HostForm({ slots }: { slots: HostSlotOption[] }) {
  const [state, action, pending] = useActionState(createGameAction, initial);

  const [slotId, setSlotId] = useState<string>("");
  const [level, setLevel] = useState<string>("casual");
  const [capacity, setCapacity] = useState(10);
  const [minimum, setMinimum] = useState(8);

  const slot = useMemo(() => slots.find((s) => s.id === slotId), [slots, slotId]);

  /**
   * Suggested per-player price: cover the pitch, split across the minimum
   * number of players, rounded up to the nearest ₦500. Hosts consistently
   * under-price and end up subsidising the game out of pocket.
   */
  const suggested = useMemo(() => {
    if (!slot) return 0;
    const { each } = splitKobo(slot.priceKobo, Math.max(1, minimum));
    return Math.ceil(each / 50_000) * 50_000;
  }, [slot, minimum]);

  const [priceNaira, setPriceNaira] = useState<number | "">("");
  const effectivePrice = priceNaira === "" ? suggested / 100 : priceNaira;
  const projected = effectivePrice * 100 * capacity;
  const covers = slot ? projected >= slot.priceKobo : false;

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        {/* 1. Slot */}
        <section className="card-t p-6">
          <h2 className="text-[18px] font-bold">1. Pick your pitch and time</h2>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">
            You book the pitch. Players pay you back as they join.
          </p>

          <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {slots.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/4 p-5 text-center text-[14px] text-ink-soft">
                No open slots in the next few days. Try again shortly.
              </p>
            )}
            {slots.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setSlotId(s.id)}
                aria-pressed={slotId === s.id}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                  slotId === s.id
                    ? "border-green/50 bg-green/10"
                    : "border-white/10 bg-white/4 hover:border-white/25"
                }`}
              >
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                    slotId === s.id ? "border-green bg-green text-[#04150c]" : "border-white/25"
                  }`}
                >
                  {slotId === s.id && <CheckIcon size={11} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {s.venueName} · {s.pitchName}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {s.area} · {s.size} · {formatRelativeDay(s.startsAt)}{" "}
                    {formatTime(s.startsAt)}
                  </span>
                </span>
                <span className="shrink-0 text-[14px] font-bold">
                  {formatNaira(s.priceKobo)}
                </span>
              </button>
            ))}
          </div>
          <input type="hidden" name="slotId" value={slotId} />
        </section>

        {/* 2. Details */}
        <section className="card-t p-6">
          <h2 className="text-[18px] font-bold">2. Describe the game</h2>

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
                placeholder="Tell them the vibe, whether you provide bibs, what to bring…"
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-ink-soft">Level</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {LEVELS.map((l) => (
                  <button
                    type="button"
                    key={l.key}
                    onClick={() => setLevel(l.key)}
                    aria-pressed={level === l.key}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      level === l.key
                        ? "border-green/50 bg-green/10"
                        : "border-white/10 bg-white/4 hover:border-white/25"
                    }`}
                  >
                    <span className={`block text-[14px] font-semibold ${level === l.key ? "text-green" : ""}`}>
                      {l.label}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
                      {l.hint}
                    </span>
                  </button>
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

        {/* 3. Numbers */}
        <section className="card-t p-6">
          <h2 className="text-[18px] font-bold">3. Numbers and money</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="capacity" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Total spots
              </label>
              <input
                id="capacity"
                name="capacity"
                type="number"
                min={4}
                max={30}
                value={capacity}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCapacity(v);
                  if (minimum > v) setMinimum(v);
                }}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
              />
            </div>

            <div>
              <label htmlFor="minimumToGuarantee" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Minimum to go ahead
              </label>
              <input
                id="minimumToGuarantee"
                name="minimumToGuarantee"
                type="number"
                min={2}
                max={capacity}
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
              />
              <p className="mt-1.5 text-[12px] text-ink-muted">
                Below this, everyone is refunded automatically.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="pricePerPlayerNaira" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Price per player (₦)
              </label>
              <input
                id="pricePerPlayerNaira"
                name="pricePerPlayerNaira"
                type="number"
                min={0}
                step={500}
                value={priceNaira === "" ? suggested / 100 : priceNaira}
                onChange={(e) => setPriceNaira(Number(e.target.value))}
                className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3.5 text-[15px] outline-none transition focus:border-green/50"
              />
              {slot && (
                <p
                  className={`mt-2 text-[12.5px] ${covers ? "text-ink-muted" : "text-orange"}`}
                >
                  {covers
                    ? `At ${capacity} players you'd collect ${formatNaira(projected)} against ${formatNaira(slot.priceKobo)} pitch hire.`
                    : `Careful — ${capacity} players at this price collects ${formatNaira(projected)}, but the pitch costs ${formatNaira(slot.priceKobo)}. You'd cover the difference yourself.`}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card-t p-6">
          <h2 className="text-[17px] font-bold">Your game</h2>

          {slot ? (
            <div className="mt-4 rounded-xl border border-green/25 bg-green/8 p-4">
              <div className="text-[14.5px] font-bold">{slot.venueName}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-soft">
                {formatRelativeDay(slot.startsAt)} · {formatTime(slot.startsAt)}–
                {formatTime(slot.endsAt)}
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-center text-[13.5px] text-ink-muted">
              Pick a slot to see the numbers
            </p>
          )}

          <dl className="mt-5 space-y-2.5 text-[14px]">
            <Row label="Pitch hire" value={slot ? formatNaira(slot.priceKobo) : "—"} />
            <Row
              label="Per player"
              value={effectivePrice ? formatNaira(effectivePrice * 100) : "—"}
            />
            <Row
              label={`If ${minimum} join`}
              value={effectivePrice ? formatNaira(effectivePrice * 100 * minimum) : "—"}
            />
            <Row
              label={`If all ${capacity} join`}
              value={effectivePrice ? formatNaira(projected) : "—"}
              strong
            />
          </dl>

          <div className="mt-5 space-y-2.5 text-[12.5px] leading-relaxed text-ink-soft">
            <p className="flex items-start gap-2">
              <UsersIcon size={14} className="mt-0.5 shrink-0 text-green" />
              You&apos;re counted as the first player automatically.
            </p>
            <p className="flex items-start gap-2">
              <ShieldIcon size={14} className="mt-0.5 shrink-0 text-green" />
              If fewer than {minimum} join, everyone is refunded and the pitch is
              released — you&apos;re never left holding the bill.
            </p>
          </div>

          {state.error && state.error !== "AUTH_REQUIRED" && (
            <p role="alert" className="mt-4 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !slotId}
            className="btn-t btn-green-t mt-5 w-full"
          >
            {pending ? "Creating…" : "Publish game"}
          </button>
        </div>
      </aside>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-white/10 pt-2.5 font-extrabold" : ""}`}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
