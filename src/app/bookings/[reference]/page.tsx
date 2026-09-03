import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getBookingByReference } from "@/lib/data/repo";
import { formatNaira, formatRelativeDay, formatTime, formatDayShort } from "@/lib/format";
import { estimateTravelMinutes, leaveByTime } from "@/lib/match";
import { Countdown } from "@/components/match/match-day";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import {
  CheckIcon,
  PinIcon,
  ClockIcon,
  CarIcon,
  WhatsAppIcon,
  ShieldIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

export default async function BookingPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const booking = await getBookingByReference(reference);
  if (!booking) notFound();

  const { slot } = booking;
  const { pitch } = slot;
  const kickoff = new Date(slot.startsAt);
  const now = Date.now();

  const travel = estimateTravelMinutes(
    pitch.venue.side === "island" ? 8 : 11,
    kickoff,
    pitch.venue.side === "island",
  );
  const leaveBy = leaveByTime(kickoff, travel);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${pitch.venue.lat},${pitch.venue.lng}`;
  const shareText = encodeURIComponent(
    `Booked ${pitch.venue.name} (${pitch.venue.area}) for ${formatDayShort(slot.startsAt)} at ${formatTime(slot.startsAt)}. Ref ${booking.reference}. Who's coming?`,
  );

  return (
    <div className="py-14">
      <div className="container-t max-w-3xl">
        <div className="card-t relative overflow-hidden p-8 text-center md:p-12">
          <span className="spokes-t" />

          <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-green/15 text-green">
            <CheckIcon size={30} />
          </span>

          <h1 className="relative mt-5 text-[clamp(24px,4.5vw,34px)] font-extrabold tracking-[-.02em]">
            You&apos;ve got the pitch
          </h1>
          <p className="relative mt-2 text-[16px] text-ink-soft">
            Reference <b className="font-mono text-ink">{booking.reference}</b> — show
            this at the gate.
          </p>

          <div className="relative mt-7 rounded-2xl border border-green/25 bg-green/8 p-5 text-left">
            <div className="text-[19px] font-bold">{pitch.venue.name}</div>
            <div className="mt-1.5 flex items-start gap-1.5 text-[14px] text-ink-soft">
              <PinIcon size={15} className="mt-0.5 shrink-0" />
              {pitch.venue.address}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-black/25 p-3.5">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <ClockIcon size={13} /> Kickoff
                </div>
                <div className="mt-1 text-[15.5px] font-bold">
                  {formatRelativeDay(slot.startsAt)}, {formatTime(slot.startsAt)}
                </div>
                <Countdown
                  to={slot.startsAt}
                  endsAt={slot.endsAt}
                  className="mt-0.5 block text-[12.5px] text-ink-soft"
                />
              </div>

              <div className="rounded-xl bg-black/25 p-3.5">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <CarIcon size={13} /> Leave by
                </div>
                <div className="mt-1 text-[15.5px] font-bold text-orange">
                  {formatTime(leaveBy.toISOString())}
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink-soft">
                  ~{travel} min in traffic
                  {pitch.venue.side === "island" ? " · crosses to the Island" : ""}
                </div>
              </div>
            </div>
          </div>

          <dl className="relative mt-5 space-y-2 text-left text-[14px]">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Pitch</dt>
              <dd>
                {pitch.name} · {pitch.size}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Paid</dt>
              <dd className="font-bold">{formatNaira(booking.paidKobo)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Method</dt>
              <dd className="capitalize">{booking.paymentMethod ?? "—"}</dd>
            </div>
          </dl>

          <div className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={`https://wa.me/?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-t btn-green-t"
            >
              <WhatsAppIcon size={18} />
              Share to your group
            </a>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-t btn-ghost-t">
              <PinIcon size={17} />
              Directions
            </a>
          </div>

          <p className="relative mt-6 flex items-center justify-center gap-2 text-[12.5px] text-ink-muted">
            <ShieldIcon size={13} className="text-green" />
            Full wallet credit if you cancel by {formatTime(new Date(kickoff.getTime() - 6 * 60 * 60 * 1000).toISOString())}
          </p>

          {(booking.status === "confirmed" || booking.status === "cancelled") && (
            <CancelBookingButton
              bookingId={booking.id}
              status={booking.status}
              eligibleForCredit={kickoff.getTime() - now >= 6 * 60 * 60 * 1000}
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-[14px]">
          <Link href="/dashboard" className="font-semibold text-green">
            My bookings →
          </Link>
          <Link href="/games" className="text-ink-soft transition hover:text-ink">
            Find a game to join
          </Link>
        </div>
      </div>
    </div>
  );
}
