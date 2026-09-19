"use client";

import { useActionState, useMemo, useState } from "react";
import { reviewMessageReportAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { formatDayShort, formatTime } from "@/lib/format";
import type { MessageReport } from "@/lib/types";

type Filter = "pending" | "reviewed" | "dismissed" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Suspended" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

export function MessageReportBoard({ reports }: { reports: MessageReport[] }) {
  const [filter, setFilter] = useState<Filter>("pending");

  const filtered = useMemo(
    () => reports.filter((r) => filter === "all" || r.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, filter],
  );

  const pending = reports.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex shrink-0 flex-wrap rounded-full border border-glass-border bg-glass p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
              filter === f.value ? "bg-green text-[#051530]" : "text-ink-muted hover:text-ink"
            }`}
          >
            {f.label}
            {f.value === "pending" && pending > 0 && ` (${pending})`}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((r) => (
          <ReportRow key={r.id} report={r} />
        ))}
        {filtered.length === 0 && (
          <div className="card-t p-8 text-center text-[14px] text-ink-soft">Nothing here.</div>
        )}
      </div>
    </div>
  );
}

const initial: ActionState = {};

function ReportRow({ report }: { report: MessageReport }) {
  const [state, formAction, pending] = useActionState(reviewMessageReportAction, initial);
  useActionToast(state);
  const [note, setNote] = useState("");

  return (
    <div className="card-t p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold">
            {report.reporter?.fullName ?? "Unknown"} reported {report.reportedUser?.fullName ?? "Unknown"}
          </div>
          <div className="mt-0.5 text-[12px] text-ink-muted">
            {report.source === "game_chat" ? "Match chat" : "Direct message"} · {formatDayShort(report.createdAt)} {formatTime(report.createdAt)}
          </div>
        </div>
        <span
          className={`chip-t !text-[11px] ${
            report.status === "pending"
              ? "!border-gold/35 !bg-gold/12 !text-gold"
              : report.status === "reviewed"
                ? "!border-orange/35 !bg-orange/12 !text-orange"
                : "!border-glass-border !text-ink-muted"
          }`}
        >
          {report.status === "reviewed" ? "suspended" : report.status}
        </span>
      </div>

      <p className="mt-3 rounded-lg bg-glass p-3 text-[13px] text-ink-soft">&ldquo;{report.messageSnapshot}&rdquo;</p>
      <p className="mt-2 text-[12.5px] text-ink-muted">Reason: {report.reason}</p>
      {report.reviewNote && <p className="mt-1 text-[12px] text-ink-muted">Review note: {report.reviewNote}</p>}

      {report.status === "pending" && (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="reportId" value={report.id} />
          <input
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Review note (optional)"
            className="min-w-0 flex-1 rounded-full border border-glass-border bg-glass px-3.5 py-2 text-[12.5px] outline-none focus:border-green/50"
          />
          <button
            type="submit"
            name="action"
            value="dismiss"
            disabled={pending}
            className="btn-t btn-ghost-t !px-3.5 !py-2 !text-[12px]"
          >
            Dismiss
          </button>
          <button
            type="submit"
            name="action"
            value="suspend_user"
            disabled={pending}
            className="btn-t !bg-orange !px-3.5 !py-2 !text-[12px] !text-white"
          >
            Suspend user
          </button>
        </form>
      )}
    </div>
  );
}
