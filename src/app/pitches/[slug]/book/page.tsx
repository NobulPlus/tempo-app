import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSlot } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/session";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { CheckoutForm } from "@/components/booking/checkout-form";
import { PinIcon, ClockIcon, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your booking",
  robots: { index: false, follow: false },
};

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slug } = await params;
  const { slot: slotId } = await searchParams;
  if (!slotId) redirect(`/pitches/${slug}`);

  const slot = await getSlot(slotId);
  if (!slot) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/pitches/${slug}/book?slot=${slotId}`)}`);
  }

  if (slot.status !== "open") {
    return (
      <div className="container-t py-20">
        <div className="card-t mx-auto max-w-lg p-10 text-center">
          <h1 className="text-[24px] font-bold">That slot just went</h1>
          <p className="mt-3 text-ink-soft">
            Someone booked it while you were deciding. Evenings move fast — pick
            another time and it&apos;s yours.
          </p>
          <Link href={`/pitches/${slug}`} className="btn-t btn-green-t mt-6">
            Back to availability
          </Link>
        </div>
      </div>
    );
  }

  const { pitch } = slot;
  const serviceFeeKobo = Math.round(slot.priceKobo * 0.05);
  const totalKobo = slot.priceKobo + serviceFeeKobo;

  return (
    <div className="py-12">
      <div className="container-t max-w-5xl">
        <h1 className="text-[clamp(26px,4.5vw,38px)] font-extrabold tracking-[-.02em]">
          Confirm your booking
        </h1>
        <p className="mt-2 text-[16px] text-ink-soft">
          One hour, one pitch, locked to your name.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.85fr]">
          <CheckoutForm slotId={slot.id} totalKobo={totalKobo} />

          <aside className="card-t h-fit p-6">
            <h2 className="text-[17px] font-bold">{pitch.venue.name}</h2>
            <div className="mt-2 flex items-start gap-1.5 text-[13.5px] text-ink-soft">
              <PinIcon size={14} className="mt-0.5 shrink-0" />
              {pitch.venue.address}
            </div>

            <div className="mt-4 rounded-xl border border-green/25 bg-green/8 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-green">
                <ClockIcon size={16} />
                {formatRelativeDay(slot.startsAt)}, {formatTime(slot.startsAt)} –{" "}
                {formatTime(slot.endsAt)}
              </div>
              <div className="mt-1 text-[12.5px] text-ink-soft">
                {pitch.name} · {pitch.size}
              </div>
            </div>

            <dl className="mt-5 space-y-2.5 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Pitch hire (1 hour)</dt>
                <dd>{formatNaira(slot.priceKobo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Tempo service fee</dt>
                <dd>{formatNaira(serviceFeeKobo)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2.5 text-[17px] font-extrabold">
                <dt>Total</dt>
                <dd>{formatNaira(totalKobo)}</dd>
              </div>
            </dl>

            <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-muted">
              <ShieldIcon size={14} className="mt-0.5 shrink-0 text-green" />
              Your slot is held the moment payment clears. Free cancellation up to 24
              hours before kickoff.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
