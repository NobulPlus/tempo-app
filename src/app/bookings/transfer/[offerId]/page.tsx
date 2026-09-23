import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getBookingTransferOffer } from "@/lib/data/repo";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { AcceptTransferForm } from "@/components/booking/accept-transfer-form";
import { PinIcon, ClockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Booking transfer offer",
  robots: { index: false, follow: false },
};

export default async function TransferOfferPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/bookings/transfer/${offerId}`)}`);

  const offer = await getBookingTransferOffer(offerId);
  // RLS already restricts reads to the two parties or an admin — a random
  // guesser gets nothing back from the query, not a permission error.
  if (!offer || offer.toUserId !== user.id) notFound();

  const booking = offer.booking;
  const slot = booking?.slot;
  const pitch = slot?.pitch;
  const now = new Date().getTime();
  const isOpen = offer.status === "open" && new Date(offer.expiresAt).getTime() > now;

  return (
    <div className="py-14">
      <div className="container-t max-w-lg">
        <div className="card-t p-8 text-center">
          <h1 className="text-[22px] font-bold">
            {offer.fromPlayer?.fullName ?? "A player"} wants to send you a booking
          </h1>

          {pitch && slot && (
            <div className="mt-5 rounded-xl border border-green/25 bg-green/8 p-4 text-left">
              <div className="text-[16px] font-bold">{pitch.venue?.name}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-soft">
                <PinIcon size={13} />
                {pitch.venue?.address}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-soft">
                <ClockIcon size={13} />
                {formatRelativeDay(slot.startsAt)}, {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
              </div>
              {booking && (
                <div className="mt-3 border-t border-white/10 pt-3 text-[14px] font-bold">
                  You&apos;ll pay {formatNaira(booking.totalKobo)}
                </div>
              )}
            </div>
          )}

          {isOpen ? (
            <AcceptTransferForm offerId={offer.id} />
          ) : (
            <p className="mt-5 text-[13.5px] text-ink-soft">
              {offer.status === "accepted" ? "This offer has already been accepted." : "This offer is no longer available."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
