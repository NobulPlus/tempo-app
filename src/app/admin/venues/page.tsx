import { VenueVerificationBoard } from "@/components/admin/venue-verification-board";
import { listVenues } from "@/lib/data/repo";

export default async function AdminVenuesPage() {
  const venues = await listVenues();
  const unverified = venues.filter((v) => !v.verified);

  return (
    <div>
      <h1 className="text-[26px] font-bold">Venue verification</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Confirm supply before it becomes bookable. Prioritise unverified venues, skim
        Lagos-side coverage and leave an internal note for the next admin.
      </p>
      <p className="mt-2 text-[13px] font-semibold text-gold">
        {unverified.length === 0
          ? "Nothing waiting on verification."
          : `${unverified.length} venue${unverified.length === 1 ? "" : "s"} waiting on verification.`}
      </p>

      <div className="mt-6">
        <VenueVerificationBoard venues={venues} />
      </div>
    </div>
  );
}
