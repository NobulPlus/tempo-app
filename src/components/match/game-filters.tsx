"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon } from "@/components/icons";

const LEVELS = [
  { key: "all", label: "All levels" },
  { key: "casual", label: "Casual" },
  { key: "intermediate", label: "Intermediate" },
  { key: "competitive", label: "Competitive" },
];

const WHENS = [
  { key: "all", label: "Anytime" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This week" },
];

const SIDES = [
  { key: "all", label: "All Lagos" },
  { key: "island", label: "Island" },
  { key: "mainland", label: "Mainland" },
];

export function GameFilters({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    });
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const group = (
    items: { key: string; label: string }[],
    param: string,
    fallback = "all",
  ) => {
    const current = params.get(param) ?? fallback;
    return items.map((i) => (
      <button
        key={i.key}
        onClick={() => update({ [param]: i.key })}
        aria-pressed={current === i.key}
        className={`rounded-full border px-4 py-2 text-[13.5px] transition ${
          current === i.key
            ? "border-green/45 bg-green/14 font-semibold text-green"
            : "border-white/12 bg-white/4 text-ink-soft hover:border-white/25"
        }`}
      >
        {i.label}
      </button>
    ));
  };

  return (
    <div className="mt-8">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
          <SearchIcon size={19} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Search games, venues or hosts…"
          aria-label="Search games"
          className="w-full rounded-full border border-white/12 bg-white/5 py-3.5 pl-12 pr-4 text-[15px] outline-none transition focus:border-green/50"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">{group(WHENS, "when")}</div>
      <div className="mt-2.5 flex flex-wrap gap-2">{group(LEVELS, "level")}</div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{group(SIDES, "side")}</div>
        <span className="text-[13px] text-ink-muted">
          {resultCount} {resultCount === 1 ? "game" : "games"}
        </span>
      </div>
    </div>
  );
}
