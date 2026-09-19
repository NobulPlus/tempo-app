"use client";

import { useActionState, useState } from "react";
import { reportMessageAction, type ActionState } from "@/app/actions";
import { AlertIcon } from "@/components/icons";
import { useActionToast } from "@/components/toast/use-action-toast";
import type { MessageReportSource } from "@/lib/types";

const initial: ActionState = {};

export function ReportMessageButton({
  reportedUserId,
  source,
  contextId,
  messageSnapshot,
}: {
  reportedUserId: string;
  source: MessageReportSource;
  contextId: string;
  messageSnapshot: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportMessageAction, initial);
  useActionToast(state, { skipSuccess: true });

  if (state.ok) {
    return <span className="text-[11px] text-ink-muted">Reported</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink-muted opacity-0 transition hover:text-orange group-hover:opacity-100"
        aria-label="Report this message"
        title="Report"
      >
        <AlertIcon size={13} />
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-glass-border bg-glass p-1.5"
      onSubmit={() => setTimeout(() => setOpen(false), 0)}
    >
      <input type="hidden" name="reportedUserId" value={reportedUserId} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="contextId" value={contextId} />
      <input type="hidden" name="messageSnapshot" value={messageSnapshot} />
      <input
        name="reason"
        required
        placeholder="Why are you reporting this?"
        className="min-w-0 flex-1 bg-transparent px-1 text-[12px] outline-none placeholder:text-ink-muted"
      />
      <button type="submit" disabled={pending} className="shrink-0 text-[11.5px] font-semibold text-orange">
        {pending ? "..." : "Report"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="shrink-0 text-[11.5px] text-ink-muted">
        Cancel
      </button>
    </form>
  );
}
