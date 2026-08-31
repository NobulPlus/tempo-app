import { listWaitlist } from "@/lib/data/repo";
import { LeadBoard } from "@/components/admin/lead-board";

export default async function AdminLeadsPage() {
  const leads = await listWaitlist();

  return (
    <div>
      <h1 className="text-[26px] font-bold">Growth leads</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Follow up venue-owner interest and use area demand to decide where Tempo should
        verify supply next.
      </p>

      <div className="mt-6">
        <LeadBoard leads={leads} />
      </div>
    </div>
  );
}
