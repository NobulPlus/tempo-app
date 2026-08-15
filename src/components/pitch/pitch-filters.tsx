"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon, PinIcon } from "@/components/icons";

const AREAS = [
  "all",
  "Lekki Phase 1",
  "Ikoyi",
  "Victoria Island",
  "Onikan",
  "Surulere",
  "Ikeja GRA",
  "Yaba",
];

const SIZES = ["all", "5-a-side", "7-a-side", "11-a-side"];

const SORTS = [
  { key: "near", label: "Nearest" },
  { key: "cheap", label: "Cheapest" },
  { key: "rated", label: "Top rated" },
  { key: "soonest", label: "Free soonest" },
];

export function PitchFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const hasOrigin = Boolean(params.get("lat"));

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    });
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search — no request per keystroke
  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  /** Real geolocation — the prototype's "Locate me" button had no handler. */
  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        update({
          lat: pos.coords.latitude.toFixed(5),
          lng: pos.coords.longitude.toFixed(5),
          sort: "near",
        });
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location blocked. You can still filter by area."
            : "Couldn't get your location.",
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  };

  const area = params.get("area") ?? "all";
  const size = params.get("size") ?? "all";
  const sort = params.get("sort") ?? "near";

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
            <SearchIcon size={19} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="Search by venue or area…"
            aria-label="Search pitches"
            className="w-full rounded-full border border-white/12 bg-white/5 py-3.5 pl-12 pr-4 text-[15px] outline-none transition focus:border-green/50"
          />
        </div>
        <button
          onClick={locate}
          disabled={locating}
          className={`btn-t !rounded-full border px-5 py-3.5 text-[14px] font-semibold transition ${
            hasOrigin
              ? "border-green/45 bg-green/12 text-green"
              : "border-white/12 bg-white/5 text-ink-soft hover:border-white/25"
          }`}
        >
          <PinIcon size={16} />
          {locating ? "Locating…" : hasOrigin ? "Using your location" : "Near me"}
        </button>
      </div>

      {locError && (
        <p role="status" className="mt-2 text-[13px] text-orange">
          {locError}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {AREAS.map((a) => (
          <button
            key={a}
            onClick={() => update({ area: a })}
            aria-pressed={area === a}
            className={`rounded-full border px-4 py-2 text-[13.5px] transition ${
              area === a
                ? "border-green/45 bg-green/14 font-semibold text-green"
                : "border-white/12 bg-white/4 text-ink-soft hover:border-white/25"
            }`}
          >
            {a === "all" ? "All areas" : a}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => update({ size: s })}
              aria-pressed={size === s}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition ${
                size === s
                  ? "border-green/45 bg-green/14 font-semibold text-green"
                  : "border-white/12 bg-white/4 text-ink-soft hover:border-white/25"
              }`}
            >
              {s === "all" ? "Any size" : s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-muted">{resultCount} pitches</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => update({ sort: s.key })}
              aria-pressed={sort === s.key}
              disabled={s.key === "near" && !hasOrigin}
              title={s.key === "near" && !hasOrigin ? "Share your location to sort by distance" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition disabled:opacity-40 ${
                sort === s.key
                  ? "border-green/45 bg-green/14 font-semibold text-green"
                  : "border-white/12 bg-white/4 text-ink-soft hover:border-white/25"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
