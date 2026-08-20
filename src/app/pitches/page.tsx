import type { Metadata } from "next";
import { Suspense } from "react";
import { listPitches } from "@/lib/mock";
import { PitchCard } from "@/components/pitch/pitch-card";
import { PitchFilters } from "@/components/pitch/pitch-filters";

export const metadata: Metadata = {
  title: "Find a pitch in Lagos",
  description:
    "Every verified football pitch on Tempo — Lekki, Ikoyi, Victoria Island, Surulere, Ikeja GRA and Yaba. Real prices, real venues.",
};

export default async function PitchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;

  const lat = one("lat");
  const lng = one("lng");
  const origin = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;

  const pitches = listPitches({
    q: one("q"),
    area: one("area"),
    size: one("size"),
    sort: (one("sort") as "near" | "cheap" | "rated") ?? (origin ? "near" : "rated"),
    origin,
  });

  return (
    <div className="py-12">
      <div className="container-t">
        <h1 className="font-display text-[clamp(32px,6vw,50px)] font-extrabold tracking-[-.02em]">
          Find a <span className="text-green">pitch</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">
          {origin
            ? "Sorted by actual distance from where you are."
            : "Every pitch here has been visited and inspected. Share your location to sort by distance."}
        </p>

        <Suspense fallback={<div className="mt-8 h-32" />}>
          <PitchFilters resultCount={pitches.length} />
        </Suspense>

        {pitches.length === 0 ? (
          <div className="card-t mt-10 p-12 text-center">
            <h2 className="text-[20px] font-bold">No pitches match that</h2>
            <p className="mt-2 text-ink-soft">
              Try widening the area, or clear your filters.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pitches.map((p) => (
              <PitchCard key={p.id} pitch={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
