import { listVenueOwnerApplicationsAdmin, listWaitlist } from "@/lib/data/repo";
import { LeadBoard } from "@/components/admin/lead-board";
import { VenueOwnerApplicationBoard } from "@/components/admin/venue-owner-application-board";

export default async function AdminLeadsPage() {
  const [applications, leads] = await Promise.all([
    listVenueOwnerApplicationsAdmin(),
    listWaitlist(),
  ]);

  return (
    <div>
      <h1 className="text-[26px] font-bold">Partner pipeline</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Review logged-in venue owner applications, then use anonymous lead demand to decide where Tempo should verify supply next.
      </p>

      <div className="mt-6">
        <VenueOwnerApplicationBoard applications={applications} />
      </div>

      <div className="mt-10">
        <h2 className="text-[20px] font-bold">Anonymous leads</h2>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          These are visitors who left contact details before creating an account.
        </p>
        <div className="mt-5">
        <LeadBoard leads={leads} />
        </div>
      </div>
    </div>
  );
}
