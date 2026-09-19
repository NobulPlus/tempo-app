"use client";

import { useActionState, useState } from "react";
import { reviewHostPayoutAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { formatNaira } from "@/lib/format";
import type { HostPayoutAdminRow } from "@/lib/data/repo";

const initial: ActionState = {};

export function HostPayoutBoard({ requests }: { requests: HostPayoutAdminRow[] }) {
  const requested = requests.filter((request) => request.status === "requested");
  return (
    <section className="mt-10 border-t border-glass-border pt-8">
      <div>
        <h2 className="text-[20px] font-bold">Host payout batch</h2>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Transfer requests manually, then record the bank reference here. Rejections restore the host&apos;s reserved credit.
        </p>
      </div>
      {requested.length > 0 && (
        <div className="mt-4 rounded-lg border border-gold/25 bg-gold/8 px-4 py-3 text-[13px] text-ink-soft">
          {requested.length} request{requested.length === 1 ? "" : "s"} awaiting review.
        </div>
      )}
      <div className="mt-4 space-y-3">
        {requests.length === 0 ? (
          <div className="card-t p-6 text-center text-[14px] text-ink-soft">No host payout requests yet.</div>
        ) : (
          requests.map((request) => <PayoutRow key={request.id} request={request} />)
        )}
      </div>
    </section>
  );
}

function PayoutRow({ request }: { request: HostPayoutAdminRow }) {
  const [state, action, pending] = useActionState(reviewHostPayoutAction, initial);
  const [decision, setDecision] = useState<"paid" | "rejected">("paid");
  useActionToast(state);
  const isOpen = request.status === "requested";

  return (
    <div className="card-t p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{request.fullName} <span className="font-normal text-ink-muted">@{request.handle}</span></div>
          <div className="mt-1 text-[12.5px] text-ink-soft">
            {request.bankName} · {request.accountName} · {request.accountNumber}
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-green">{formatNaira(request.amountKobo)}</div>
          <div className="text-[12px] text-ink-muted">Friday batch: {request.scheduledFor}</div>
        </div>
      </div>

      {isOpen ? (
        <form action={action} className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
          <input type="hidden" name="payoutId" value={request.id} />
          <select name="decision" value={decision} onChange={(event) => setDecision(event.target.value as "paid" | "rejected")} className="input-t !py-2">
            <option value="paid">Mark paid</option>
            <option value="rejected">Reject and restore</option>
          </select>
          <input
            name={decision === "paid" ? "transferReference" : "note"}
            required
            placeholder={decision === "paid" ? "Bank transfer reference" : "Reason for rejection"}
            className="input-t !py-2"
          />
          <button type="submit" disabled={pending} className="btn-t btn-primary-t !px-4 !py-2 !text-[12px]">
            {pending ? "Saving..." : decision === "paid" ? "Confirm paid" : "Reject"}
          </button>
        </form>
      ) : (
        <div className="mt-3 text-[12.5px] text-ink-muted">
          {request.status === "paid" ? `Paid · ${request.transferReference ?? "Transfer reference not recorded"}` : `Rejected · ${request.adminNote ?? "No reason recorded"}`}
        </div>
      )}
    </div>
  );
}
