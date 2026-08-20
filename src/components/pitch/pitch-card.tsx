import Link from "next/link";
import Image from "next/image";
import { formatNaira, formatDistance } from "@/lib/format";
import {
  PinIcon,
  StarIcon,
  ShieldIcon,
  LightsIcon,
  ShowerIcon,
  ParkingIcon,
} from "@/components/icons";
import type { PitchWithVenue } from "@/lib/mock";

const AMENITY_ICON: Record<string, typeof LightsIcon> = {
  Floodlights: LightsIcon,
  Showers: ShowerIcon,
  Parking: ParkingIcon,
};

const SURFACE_LABEL: Record<string, string> = {
  astro: "Astro turf",
  grass: "Natural grass",
  indoor: "Indoor",
  concrete: "Concrete",
};

export function PitchCard({ pitch }: { pitch: PitchWithVenue }) {
  const { venue } = pitch;
  const photo = venue.photos[0];

  return (
    <article className="card-t card-t-hover overflow-hidden">
      <div className="relative h-[150px] overflow-hidden bg-bg-elevated">
        {photo && (
          <Image
            src={photo}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        <span className="absolute left-3 top-3">
          <span className="chip-t !bg-black/40">{pitch.size}</span>
        </span>

        {venue.verified && (
          <span className="absolute right-3 top-3">
            <span className="chip-t !border-green/35 !bg-black/40 !text-green" title="Inspected by Tempo">
              <ShieldIcon size={12} />
              Verified
            </span>
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/pitches/${pitch.slug}`}>
              <h3 className="truncate text-[18px] font-bold transition-colors hover:text-green">
                {venue.name}
              </h3>
            </Link>
            <div className="mt-1 flex items-center gap-1.5 text-[13.5px] text-ink-soft">
              <PinIcon size={14} />
              <span className="truncate">
                {venue.area}
                {pitch.distance !== undefined && ` · ${formatDistance(pitch.distance)}`}
              </span>
            </div>
          </div>

          {pitch.rating !== null && (
            <div className="flex shrink-0 items-center gap-1 text-[13.5px]">
              <StarIcon size={14} className="text-gold" />
              <b>{pitch.rating?.toFixed(1)}</b>
              <span className="text-ink-muted">({pitch.reviewCount})</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip-t">{SURFACE_LABEL[pitch.surface]}</span>
          {venue.amenities.slice(0, 3).map((a) => {
            const Icon = AMENITY_ICON[a];
            return (
              <span key={a} className="chip-t">
                {Icon && <Icon size={12} />}
                {a}
              </span>
            );
          })}
        </div>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-glass-border pt-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">From</div>
            <div className="text-[20px] font-bold">
              {formatNaira(pitch.pricePerHourKobo)}
              <span className="text-[13px] font-medium text-ink-muted">/hr</span>
            </div>
          </div>
          <Link href={`/pitches/${pitch.slug}`} className="btn-t btn-green-t !px-6 !py-3 !text-[14px]">
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
