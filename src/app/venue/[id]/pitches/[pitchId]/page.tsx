import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getPitchById, getSlotsForPitch } from "@/lib/data/repo";
import { GenerateSlotsForm } from "@/components/venue/generate-slots-form";
import { SlotList } from "@/components/venue/slot-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage availability",
  robots: { index: false, follow: false },
};

export default async function ManageAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string; pitchId: string }>;
}) {
  const { id, pitchId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/venue/${id}/pitches/${pitchId}`);

  const pitch = await getPitchById(pitchId);
  if (!pitch || pitch.venueId !== id) notFound();
  if (pitch.venue.ownerId !== user.id) redirect("/venue");

  const slots = await getSlotsForPitch(pitchId, 21);

  return (
    <div className="py-12">
      <div className="container-t max-w-4xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-[13.5px] text-ink-muted">
          <Link href="/venue" className="transition hover:text-green">
            Venue dashboard
          </Link>
          <span>/</span>
          <Link href={`/venue/${id}`} className="transition hover:text-green">
            {pitch.venue.name}
          </Link>
          <span>/</span>
          <span className="text-ink">{pitch.name}</span>
        </nav>

        <h1 className="text-[26px] font-extrabold">{pitch.name} — availability</h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Booked hours (green) can&apos;t be changed here. Open hours (grey) can be
          blocked for maintenance; blocked hours (orange) can be reopened.
        </p>

        <div className="mt-6">
          <GenerateSlotsForm pitchId={pitchId} />
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-[17px] font-bold">Upcoming hours</h2>
          <SlotList slots={slots} />
        </div>
      </div>
    </div>
  );
}
