import { listMessageReports } from "@/lib/data/repo";
import { MessageReportBoard } from "@/components/admin/message-report-board";

export default async function AdminReportsPage() {
  const reports = await listMessageReports();
  const pending = reports.filter((r) => r.status === "pending");

  return (
    <div>
      <h1 className="text-[26px] font-bold">Message reports</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Reports filed against match chat or direct messages. Suspending a user here uses the
        same suspension every other moderation action in Tempo goes through.
      </p>
      <p className="mt-2 text-[13px] font-semibold text-gold">
        {pending.length === 0
          ? "Nothing waiting on review."
          : `${pending.length} report${pending.length === 1 ? "" : "s"} waiting on review.`}
      </p>

      <div className="mt-6">
        <MessageReportBoard reports={reports} />
      </div>
    </div>
  );
}
