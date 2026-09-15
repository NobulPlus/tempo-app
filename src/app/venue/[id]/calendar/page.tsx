import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isVenueOwner } from "@/lib/session";
import { getVenueById, getBookingsForVenue, getGamesForVenue } from "@/lib/data/repo";
import { VenueCalendar } from "@/components/venue/venue-calendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export default async function VenueCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/venue/${id}/calendar`);
  if (!isVenueOwner(user)) redirect("/venue");

  const venue = await getVenueById(id);
  if (!venue) notFound();
  if (venue.ownerId !== user.id) redirect("/venue");

  const [bookings, games] = await Promise.all([getBookingsForVenue(venue.id), getGamesForVenue(venue.id)]);

  return (
    <div className="py-12">
      <div className="container-workspace-t">
        <nav className="mb-6 flex items-center gap-2 text-[13.5px] text-ink-muted">
          <Link href="/venue" className="transition hover:text-green">
            Venue dashboard
          </Link>
          <span>/</span>
          <Link href={`/venue/${venue.id}`} className="transition hover:text-green">
            {venue.name}
          </Link>
          <span>/</span>
          <span className="text-ink">Calendar</span>
        </nav>

        <h1 className="text-[26px] font-extrabold">Calendar — {venue.name}</h1>
        <p className="mt-2 text-[14px] text-ink-soft">
          Everything happening across this venue&apos;s pitches — direct bookings and
          hosted games together.
        </p>

        <div className="mt-6">
          <VenueCalendar bookings={bookings} games={games} />
        </div>
      </div>
    </div>
  );
}
