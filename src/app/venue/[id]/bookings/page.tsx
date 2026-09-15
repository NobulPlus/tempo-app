import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isVenueOwner } from "@/lib/session";
import { getVenueById, getBookingsForVenue } from "@/lib/data/repo";
import { markBookingAttendanceFormAction } from "@/app/actions";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { CheckIcon, ClockIcon, PinIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "!border-green/35 !bg-green/12 !text-green",
  cancelled: "!border-white/15 !bg-white/6 !text-ink-muted",
  completed: "!border-blue/35 !bg-blue/12 !text-blue",
};

export default async function VenueBookingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/venue/${id}/bookings`);
  if (!isVenueOwner(user)) redirect("/venue");

  const venue = await getVenueById(id);
  if (!venue) notFound();
  if (venue.ownerId !== user.id) redirect("/venue");

  const bookings = await getBookingsForVenue(venue.id);
  const sorted = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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
          <span className="text-ink">Bookings</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[26px] font-extrabold">Bookings — {venue.name}</h1>
          <Link
            href={`/venue/${venue.id}/calendar`}
            className="text-[13.5px] font-semibold text-green transition hover:opacity-80"
          >
            View calendar →
          </Link>
        </div>
        <p className="mt-2 text-[14px] text-ink-soft">
          Real booking records for every pitch at this venue — who booked, when, and
          for how much.
        </p>

        <div className="mt-6 space-y-2.5">
          {sorted.map((b) => (
            <div key={b.id} className="card-t flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14.5px] font-semibold">
                    {b.player?.fullName ?? "Unknown player"}
                  </span>
                  <span className={`chip-t !py-0.5 !text-[10.5px] ${STATUS_STYLE[b.status] ?? ""}`}>
                    {b.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <PinIcon size={12} />
                    {b.slot.pitch.name}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon size={12} />
                    {formatRelativeDay(b.slot.startsAt)} · {formatTime(b.slot.startsAt)}
                  </span>
                  <span>{b.reference}</span>
                  <span className="capitalize">{(b.attendanceStatus ?? "booked").replaceAll("_", " ")}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="text-[15px] font-bold">{formatNaira(b.totalKobo)}</div>
                {b.status === "confirmed" && (
                  <form action={markBookingAttendanceFormAction} className="flex flex-wrap justify-end gap-1.5">
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="reference" value={b.reference} />
                    <button
                      type="submit"
                      name="event"
                      value="checked_in"
                      className="btn-t btn-ghost-t !px-3 !py-1.5 !text-[12px]"
                    >
                      <CheckIcon size={13} />
                      In
                    </button>
                    <button
                      type="submit"
                      name="event"
                      value="late"
                      className="btn-t btn-ghost-t !px-3 !py-1.5 !text-[12px]"
                    >
                      <ClockIcon size={13} />
                      Late
                    </button>
                    <button
                      type="submit"
                      name="event"
                      value="no_show"
                      className="btn-t btn-ghost-t !px-3 !py-1.5 !text-[12px]"
                    >
                      No-show
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="card-t p-8 text-center text-[14px] text-ink-soft">
              No bookings on this venue yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
