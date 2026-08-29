import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getPitchBySlug, listGames, getSlotsForPitch } from "@/lib/data/repo";
import { GameCard } from "@/components/match/game-card";
import { SlotPicker } from "@/components/pitch/slot-picker";
import { formatNaira } from "@/lib/format";
import { estimateTravelMinutes } from "@/lib/match";
import {
  PinIcon,
  StarIcon,
  ShieldIcon,
  LightsIcon,
  ShowerIcon,
  ParkingIcon,
  PhoneIcon,
  CarIcon,
  CheckIcon,
} from "@/components/icons";

const AMENITY_ICON: Record<string, typeof LightsIcon> = {
  Floodlights: LightsIcon,
  Showers: ShowerIcon,
  Parking: ParkingIcon,
};

export const dynamic = "force-dynamic";

const SURFACE_LABEL: Record<string, string> = {
  astro: "Astro turf",
  grass: "Natural grass",
  indoor: "Indoor court",
  concrete: "Concrete",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pitch = await getPitchBySlug(slug);
  if (!pitch) return { title: "Pitch not found" };

  return {
    title: `${pitch.venue.name}, ${pitch.venue.area}`,
    description: `${pitch.name} at ${pitch.venue.name} in ${pitch.venue.area}, Lagos. ${pitch.size} ${SURFACE_LABEL[pitch.surface]} from ${formatNaira(pitch.pricePerHourKobo)} per hour.`,
  };
}

export default async function PitchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pitch = await getPitchBySlug(slug);
  if (!pitch) notFound();

  const [allGames, slots] = await Promise.all([listGames(), getSlotsForPitch(pitch.id)]);
  const gamesHere = allGames.filter((g) => g.pitchId === pitch.id);
  const { venue } = pitch;
  const photo = venue.photos[0];

  const travel = estimateTravelMinutes(
    venue.side === "island" ? 8 : 11,
    new Date(new Date().setHours(19, 0, 0, 0)),
    venue.side === "island",
  );

  return (
    <div className="py-10">
      <div className="container-t">
        <nav className="mb-6 flex items-center gap-2 text-[13.5px] text-ink-muted">
          <Link href="/pitches" className="transition hover:text-green">
            Pitches
          </Link>
          <span>/</span>
          <span className="text-ink-soft">{venue.area}</span>
          <span>/</span>
          <span className="text-ink">{venue.name}</span>
        </nav>

        <div className="card-t relative overflow-hidden">
          <div className="relative h-[210px] md:h-[280px]">
            {photo && (
              <Image src={photo} alt="" fill unoptimized className="object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/10 to-transparent" />
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span className="chip-t !bg-black/40">{pitch.size}</span>
              <span className="chip-t !bg-black/40">{SURFACE_LABEL[pitch.surface]}</span>
              {pitch.covered && <span className="chip-t !bg-black/40">Covered</span>}
            </div>
            {venue.verified && (
              <span className="absolute right-5 top-5">
                <span className="chip-t !border-green/35 !bg-black/40 !text-green">
                  <ShieldIcon size={13} />
                  Verified by Tempo
                </span>
              </span>
            )}
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-[clamp(26px,4.5vw,38px)] font-extrabold tracking-[-.02em]">
                  {venue.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14.5px] text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <PinIcon size={15} />
                    {venue.address}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CarIcon size={15} />~{travel} min at 7pm
                  </span>
                </div>
              </div>

              {pitch.rating !== null && (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <StarIcon size={18} className="text-gold" />
                    <span className="text-[22px] font-extrabold">{pitch.rating?.toFixed(1)}</span>
                  </div>
                  <div className="text-[13px] text-ink-muted">{pitch.reviewCount} reviews</div>
                </div>
              )}
            </div>

            <p className="mt-5 max-w-3xl text-[15.5px] leading-relaxed text-ink-soft">
              {venue.description}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {venue.amenities.map((a) => {
                const Icon = AMENITY_ICON[a];
                return (
                  <span key={a} className="chip-t">
                    {Icon ? <Icon size={12} /> : <CheckIcon size={11} />}
                    {a}
                  </span>
                );
              })}
            </div>

            {venue.phone && (
              <a
                href={`tel:${venue.phone}`}
                className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-green transition hover:gap-3"
              >
                <PhoneIcon size={16} />
                {venue.phone}
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-8">
            <section id="availability">
              <SlotPicker slots={slots} pitchSlug={slug} />
            </section>

            {gamesHere.length > 0 && (
              <section>
                <h2 className="text-[20px] font-bold">Open games at {venue.name}</h2>
                <p className="mt-1.5 text-[14.5px] text-ink-soft">
                  Don&apos;t want the whole pitch? Join one of these instead.
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {gamesHere.map((g) => (
                    <GameCard key={g.id} game={g} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-5">
            <div className="card-t p-6">
              <div className="text-[12px] uppercase tracking-wide text-ink-muted">
                Off-peak from
              </div>
              <div className="mt-1 text-[30px] font-extrabold">
                {formatNaira(pitch.pricePerHourKobo)}
                <span className="text-[15px] font-medium text-ink-muted">/hr</span>
              </div>
              <div className="mt-3 space-y-2 text-[13.5px] text-ink-soft">
                <div className="flex justify-between">
                  <span>Peak (weekday 5–9pm)</span>
                  <b>{formatNaira(Math.round(pitch.pricePerHourKobo * pitch.peakMultiplier))}</b>
                </div>
                <div className="flex justify-between">
                  <span>Pitch</span>
                  <b>{pitch.name}</b>
                </div>
                <div className="flex justify-between">
                  <span>Floodlights</span>
                  <b>{pitch.floodlights ? "Yes" : "No"}</b>
                </div>
              </div>
              <a href="#availability" className="btn-t btn-green-t mt-5 w-full">
                Check availability
              </a>
            </div>

            {venue.verified && (
              <div className="card-t border-green/20 p-6">
                <h3 className="flex items-center gap-2 text-[15px] font-bold text-green">
                  <ShieldIcon size={16} />
                  What verified means
                </h3>
                <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-ink-soft">
                  <li>Someone from Tempo visited in person.</li>
                  <li>Surface, lighting and changing facilities checked.</li>
                  <li>Contact details confirmed with the operator.</li>
                  <li>Re-checked every 6 months.</li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
