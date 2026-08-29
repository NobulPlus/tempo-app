import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { listPitches } from "@/lib/data/repo";
import { formatNaira } from "@/lib/format";
import { PitchCard } from "@/components/pitch/pitch-card";
import { PitchFilters } from "@/components/pitch/pitch-filters";
import { Reveal } from "@/components/ui/reveal";
import { PinIcon, StarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

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

  const pitches = await listPitches({
    q: one("q"),
    area: one("area"),
    size: one("size"),
    sort: (one("sort") as "near" | "cheap" | "rated") ?? (origin ? "near" : "rated"),
    origin,
  });

  return (
    <div className="py-12">
      <div className="container-t">
        <div className="grain-t relative overflow-hidden rounded-2xl">
          <span className="spokes-t" />
          <div className="relative">
            <h1 className="font-display text-[clamp(32px,6vw,50px)] font-extrabold tracking-[-.02em]">
              Find a <span className="text-gradient-brand">pitch</span>
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">
              {origin
                ? "Sorted by actual distance from where you are."
                : "Every pitch here has been visited and inspected. Share your location to sort by distance."}
            </p>
          </div>
        </div>

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
          <>
            {pitches.length > 1 && (
              <Reveal
                as="article"
                className="card-t card-t-hover relative mt-8 overflow-hidden lg:grid lg:grid-cols-[1.3fr_1fr]"
              >
                <div className="relative h-[220px] overflow-hidden bg-bg-elevated lg:h-full">
                  {pitches[0].venue.photos[0] && (
                    <Image
                      src={pitches[0].venue.photos[0]}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(min-width: 1024px) 55vw, 100vw"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent lg:bg-gradient-to-r" />
                  <span className="absolute left-4 top-4">
                    <span className="chip-t !border-gold/35 !bg-black/40 !text-gold">
                      <StarIcon size={12} />
                      {origin ? "Nearest match" : "Top result"}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col justify-center p-7">
                  <div className="flex items-center gap-1.5 text-[13.5px] text-ink-soft">
                    <PinIcon size={14} />
                    {pitches[0].venue.area}
                  </div>
                  <h3 className="mt-1.5 font-display text-[26px] font-extrabold">
                    {pitches[0].venue.name}
                  </h3>
                  {pitches[0].rating !== null && (
                    <div className="mt-2 flex items-center gap-1.5 text-[14px]">
                      <StarIcon size={15} className="text-gold" />
                      <b>{pitches[0].rating?.toFixed(1)}</b>
                      <span className="text-ink-muted">({pitches[0].reviewCount} reviews)</span>
                    </div>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-glass-border pt-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-ink-muted">From</div>
                      <div className="text-[22px] font-bold">
                        {formatNaira(pitches[0].pricePerHourKobo)}
                        <span className="text-[13px] font-medium text-ink-muted">/hr</span>
                      </div>
                    </div>
                    <Link href={`/pitches/${pitches[0].slug}`} className="btn-t btn-green-t">
                      View pitch
                    </Link>
                  </div>
                </div>
              </Reveal>
            )}

            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(pitches.length > 1 ? pitches.slice(1) : pitches).map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 6) * 60}>
                  <PitchCard pitch={p} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
