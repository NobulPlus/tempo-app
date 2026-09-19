"use client";

import { useActionState } from "react";
import { requestHostPayoutAction, saveHostBankAccountAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { formatNaira } from "@/lib/format";
import type { HostBankAccount, HostPayoutRequest } from "@/lib/types";

const initial: ActionState = {};

export function HostPayoutPanel({
  bankAccount,
  requests,
  withdrawableKobo,
}: {
  bankAccount: HostBankAccount | null;
  requests: HostPayoutRequest[];
  withdrawableKobo: number;
}) {
  const [bankState, bankAction, bankPending] = useActionState(saveHostBankAccountAction, initial);
  const [payoutState, payoutAction, payoutPending] = useActionState(requestHostPayoutAction, initial);
  useActionToast(bankState);
  useActionToast(payoutState);

  return (
    <section className="mt-8 border-t border-glass-border pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[18px] font-bold">Host payouts</h2>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
            Only earnings from your completed hosted sessions can be paid to your bank account.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[12px] text-ink-muted">Available to withdraw</div>
          <div className="text-[20px] font-extrabold text-green">{formatNaira(withdrawableKobo)}</div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-gold/25 bg-gold/8 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
        Requests submitted by Thursday night are included in Friday&apos;s payout batch. Friday and weekend requests move to the following Friday.
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form action={bankAction} className="card-t space-y-3 p-5">
          <div>
            <h3 className="text-[15px] font-bold">Bank account</h3>
            <p className="mt-1 text-[12.5px] text-ink-muted">Used only for approved host payouts.</p>
          </div>
          <input name="bankName" required defaultValue={bankAccount?.bankName ?? ""} placeholder="Bank name" className="input-t" />
          <input name="accountName" required defaultValue={bankAccount?.accountName ?? ""} placeholder="Account holder name" className="input-t" />
          <input
            name="accountNumber"
            required
            inputMode="numeric"
            pattern="[0-9]{10}"
            maxLength={10}
            defaultValue={bankAccount?.accountNumber ?? ""}
            placeholder="10-digit account number"
            className="input-t"
          />
          {bankState.error && <p className="text-[12.5px] text-red-400">{bankState.error}</p>}
          <button type="submit" disabled={bankPending} className="btn-t btn-ghost-t w-full">
            {bankPending ? "Saving..." : bankAccount ? "Update bank details" : "Save bank details"}
          </button>
        </form>

        <form action={payoutAction} className="card-t space-y-3 p-5">
          <div>
            <h3 className="text-[15px] font-bold">Request a payout</h3>
            <p className="mt-1 text-[12.5px] text-ink-muted">Minimum payout: ₦1,000. The amount is reserved while Tempo processes it.</p>
          </div>
          <label className="block text-[12px] font-semibold uppercase tracking-[.6px] text-ink-muted" htmlFor="amountNaira">
            Amount in naira
          </label>
          <input
            id="amountNaira"
            name="amountNaira"
            required
            min="1000"
            max="5000000"
            step="1"
            inputMode="numeric"
            type="number"
            placeholder="0"
            disabled={!bankAccount || withdrawableKobo < 100000}
            className="input-t"
          />
          {payoutState.error && <p className="text-[12.5px] text-red-400">{payoutState.error}</p>}
          {!bankAccount && <p className="text-[12.5px] text-gold">Save a bank account before requesting a payout.</p>}
          <button type="submit" disabled={payoutPending || !bankAccount || withdrawableKobo < 100000} className="btn-t btn-primary-t w-full">
            {payoutPending ? "Requesting..." : "Request Friday payout"}
          </button>
        </form>
      </div>

      {requests.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[15px] font-bold">Payout history</h3>
          <ul className="mt-3 space-y-2">
            {requests.map((request) => (
              <li key={request.id} className="card-t flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-[13px]">
                <span className="font-bold text-green">{formatNaira(request.amountKobo)}</span>
                <span className="text-ink-soft">{request.bankName} · {maskAccount(request.accountNumber)}</span>
                <span className="ml-auto font-semibold capitalize text-ink">{request.status}</span>
                <span className="w-full text-[12px] text-ink-muted">
                  {request.status === "requested" ? `Scheduled for ${formatPayoutDate(request.scheduledFor)}` : request.transferReference ? `Transfer: ${request.transferReference}` : request.adminNote ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function maskAccount(number: string) {
  return `••••••${number.slice(-4)}`;
}

function formatPayoutDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}
