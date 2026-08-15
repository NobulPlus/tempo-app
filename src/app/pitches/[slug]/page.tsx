import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPitchBySlug, getSlotsForPitch, listGames } from "@/lib/data/repo";
import { SlotPicker } from "@/components/pitch/slot-picker";
import { GameCard } from "@/components/match/game-card";
import { formatNaira } from "@/lib/format";
import { estimateTravelMinutes } from "@/lib/match";
import {
  PinIcon,
  StarIcon,
  ShieldIcon,
  BallDetailedIcon,
  LightsIcon,
  ShowerIcon,
  ParkingIcon,
  PhoneIcon,
  CarIcon,
  CheckIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const AMENITY_ICON: Record<string, typeof LightsIcon> = {
  Floodlights: LightsIcon,
  Showers: ShowerIcon,
  Parking: ParkingIcon,
};

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
    description: `Book ${pitch.name} at ${pitch.venue.name} in ${pitch.venue.area}, Lagos. ${pitch.size} ${SURFACE_LABEL[pitch.surface]} from ${formatNaira(pitch.pricePerHourKobo)} per hour.`,
    openGraph: {
      title: `${pitch.venue.name} — ${pitch.venue.area}`,
      description: pitch.venue.description,
    },
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

  const [slots, allGames] = await Promise.all([
    getSlotsForPitch(pitch.id),
    listGames(),
  ]);
  const gamesHere = allGames.filter((g) => g.pitchId === pitch.id);

  const { venue } = pitch;

  // Rough travel estimate from a central Lagos reference point, so the number
  // is illustrative rather than fake-precise.
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

        {/* Hero band */}
        <div className="card-t relative overflow-hidden">
          <div className="relative grid h-[210px] place-items-center bg-gradient-to-br from-[#132033] to-[#0d1523] md:h-[260px]">
            <span className="spokes-t" />
            <BallDetailedIcon size={120} className="relative text-green/20" />
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span className="chip-t">{pitch.size}</span>
              <span className="chip-t">{SURFACE_LABEL[pitch.surface]}</span>
              {pitch.covered && <span className="chip-t">Covered</span>}
            </div>
            {venue.verified && (
              <span className="absolute right-5 top-5">
                <span className="chip-t !border-green/35 !bg-green/12 !text-green">
                  <ShieldIcon size={13} />
                  Verified by Tempo
                </span>
              </span>
            )}
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[clamp(26px,4.5vw,38px)] font-extrabold tracking-[-.02em]">
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
                    <span className="text-[22px] font-extrabold">
                      {pitch.rating?.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[13px] text-ink-muted">
                    {pitch.reviewCount} reviews
                  </div>
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

        {/* Booking */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <SlotPicker slots={slots} pitchSlug={pitch.slug} />

            {gamesHere.length > 0 && (
              <section className="mt-8">
                <h2 className="text-[20px] font-bold">
                  Open games at {venue.name}
                </h2>
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
                  <b>
                    {formatNaira(
                      Math.round(pitch.pricePerHourKobo * pitch.peakMultiplier),
                    )}
                  </b>
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
                <Link
                  href="/verification"
                  className="mt-4 inline-block text-[13.5px] font-semibold text-green"
                >
                  How verification works →
                </Link>
              </div>
            )}

            <div className="card-t p-6">
              <h3 className="text-[15px] font-bold">Cancellations</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                Free cancellation up to 24 hours before kickoff. Between 24 and 6
                hours you get 50% back. Under 6 hours the slot is non-refundable —
                the venue has already turned other bookings away.
              </p>
              <Link
                href="/legal/refunds"
                className="mt-3 inline-block text-[13.5px] font-semibold text-green"
              >
                Full policy →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
