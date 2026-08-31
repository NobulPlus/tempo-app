import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getVenueById, getPitchesForVenue } from "@/lib/data/repo";
import { VenueDetailsForm } from "@/components/venue/venue-details-form";
import { AddPitchForm } from "@/components/venue/add-pitch-form";
import { PitchManageCard } from "@/components/venue/pitch-manage-card";
import { ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage venue",
  robots: { index: false, follow: false },
};

export default async function ManageVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/venue/${id}`);

  const venue = await getVenueById(id);
  if (!venue) notFound();
  if (venue.ownerId !== user.id) redirect("/venue");

  const pitches = await getPitchesForVenue(venue.id);

  return (
    <div className="py-12">
      <div className="container-t max-w-4xl">
        <nav className="mb-6 flex items-center gap-2 text-[13.5px] text-ink-muted">
          <Link href="/venue" className="transition hover:text-green">
            Venue dashboard
          </Link>
          <span>/</span>
          <span className="text-ink">{venue.name}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-extrabold">{venue.name}</h1>
          {venue.verified ? (
            <span className="chip-t !border-green/35 !bg-green/12 !text-green">
              <ShieldIcon size={12} />
              Verified
            </span>
          ) : (
            <span className="chip-t !border-gold/35 !bg-gold/12 !text-gold">
              Awaiting verification
            </span>
          )}
        </div>
        {!venue.verified && (
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
            Add your pitches and availability now — someone from Tempo will visit and
            verify the venue before it&apos;s bookable by players.
          </p>
        )}

        <section className="card-t mt-6 p-6">
          <h2 className="text-[17px] font-bold">Venue details</h2>
          <div className="mt-4">
            <VenueDetailsForm venue={venue} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[17px] font-bold">
            Pitches <span className="text-ink-muted">({pitches.length})</span>
          </h2>
          <div className="mt-4 space-y-3">
            {pitches.map((pitch) => (
              <PitchManageCard key={pitch.id} venueId={venue.id} pitch={pitch} />
            ))}
            {pitches.length === 0 && (
              <div className="card-t p-6 text-center text-[14px] text-ink-soft">
                No pitches yet — add your first one below.
              </div>
            )}
          </div>

          <div className="mt-5">
            <AddPitchForm venueId={venue.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
