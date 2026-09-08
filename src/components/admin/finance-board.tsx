"use client";

import { useMemo, useState } from "react";
import { SearchIcon, WalletIcon } from "@/components/icons";
import { formatNaira, formatDayShort, formatTime } from "@/lib/format";
import type { FinanceSummary, WalletAdminRow, WalletTransactionAdminRow } from "@/lib/data/repo";

type View = "wallets" | "transactions";

const VIEWS: { value: View; label: string }[] = [
  { value: "transactions", label: "Transactions" },
  { value: "wallets", label: "Wallets" },
];

export function FinanceBoard({
  summary,
  wallets,
  transactions,
}: {
  summary: FinanceSummary;
  wallets: WalletAdminRow[];
  transactions: WalletTransactionAdminRow[];
}) {
  const [view, setView] = useState<View>("transactions");
  const [q, setQ] = useState("");

  const filteredWallets = useMemo(() => {
    if (!q) return wallets;
    const needle = q.toLowerCase();
    return wallets.filter((w) => `${w.fullName} ${w.handle}`.toLowerCase().includes(needle));
  }, [wallets, q]);

  const filteredTxns = useMemo(() => {
    if (!q) return transactions;
    const needle = q.toLowerCase();
    return transactions.filter((t) => `${t.fullName} ${t.handle} ${t.reference}`.toLowerCase().includes(needle));
  }, [transactions, q]);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Wallet liability" value={formatNaira(summary.totalWalletLiabilityKobo)} />
        <Stat label="Top-up volume" value={formatNaira(summary.totalTopupVolumeKobo)} tone="text-green" />
        <Stat label="Booking payments" value={formatNaira(summary.totalBookingPaymentVolumeKobo)} />
        <Stat label="Game payments" value={formatNaira(summary.totalGamePaymentVolumeKobo)} />
        <Stat label="Host deposits" value={formatNaira(summary.totalHostDepositVolumeKobo)} />
        <Stat label="Cancellation credits" value={formatNaira(summary.totalCancellationCreditsKobo)} tone="text-gold" />
        <Stat label="Game refunds" value={formatNaira(summary.totalGameRefundsKobo)} tone="text-gold" />
        <Stat label="Host reimbursements" value={formatNaira(summary.totalHostReimbursementsKobo)} tone="text-green" />
        <Stat label="Held game funds" value={formatNaira(summary.tempoHeldGameFundsKobo)} />
        <Stat label="Venue payable" value={formatNaira(summary.totalVenuePendingKobo)} tone="text-gold" />
        <Stat label="Ready for payout" value={formatNaira(summary.totalVenueAvailableKobo)} tone="text-green" />
        <Stat label="Venue paid out" value={formatNaira(summary.totalVenuePaidOutKobo)} />
        <Stat label="Platform fee ledger" value={formatNaira(summary.totalPlatformFeeLedgerKobo)} tone="text-green" />
        <Stat label="Est. service-fee revenue" value={formatNaira(summary.serviceFeeRevenueKobo)} tone="text-green" />
      </div>

      <div className="mt-6 card-t p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <SearchIcon size={15} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, handle or reference"
              className="w-full rounded-full border border-glass-border bg-glass py-2.5 pl-9 pr-4 text-[13.5px] outline-none transition focus:border-green/50"
            />
          </div>
          <div className="flex shrink-0 rounded-full border border-glass-border bg-glass p-1">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setView(v.value)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                  view === v.value ? "bg-green text-[#051530]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "transactions" ? (
        <div className="mt-4 space-y-2">
          {filteredTxns.map((t) => (
            <TransactionRow key={t.id} txn={t} />
          ))}
          {filteredTxns.length === 0 && (
            <div className="card-t p-8 text-center text-[14px] text-ink-soft">No transactions match.</div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filteredWallets.map((w) => (
            <div key={w.userId} className="card-t flex items-center gap-4 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green/10 text-green">
                <WalletIcon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold">{w.fullName}</div>
                <div className="truncate text-[12.5px] text-ink-muted">@{w.handle}</div>
              </div>
              <div className="shrink-0 text-[15px] font-bold">{formatNaira(w.balanceKobo)}</div>
            </div>
          ))}
          {filteredWallets.length === 0 && (
            <div className="card-t p-8 text-center text-[14px] text-ink-soft">No wallets match.</div>
          )}
        </div>
      )}
    </div>
  );
}

const TXN_LABELS: Record<WalletTransactionAdminRow["type"], string> = {
  topup: "Top-up",
  booking_payment: "Booking payment",
  cancellation_credit: "Cancellation credit",
  game_payment: "Game payment",
  game_refund: "Game refund",
  host_game_deposit: "Pitch deposit (hosting)",
  host_reimbursement: "Hosting reimbursement",
};

function TransactionRow({ txn }: { txn: WalletTransactionAdminRow }) {
  const isCredit = txn.amountKobo >= 0;
  const label = TXN_LABELS[txn.type];

  return (
    <div className="card-t flex items-center gap-4 p-4">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          txn.status === "pending" ? "bg-gold/12 text-gold" : isCredit ? "bg-green/12 text-green" : "bg-white/6 text-ink-soft"
        }`}
      >
        <WalletIcon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold">
          {txn.fullName} <span className="font-normal text-ink-muted">· {label}</span>
        </div>
        <div className="truncate text-[12px] text-ink-muted">
          @{txn.handle} · {txn.reference} · {formatDayShort(txn.createdAt)} {formatTime(txn.createdAt)}
          {txn.status === "pending" && " · Pending"}
        </div>
      </div>
      <div className={`shrink-0 text-[15px] font-bold ${isCredit ? "text-green" : ""}`}>
        {isCredit ? "+" : "−"}
        {formatNaira(Math.abs(txn.amountKobo))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card-t p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[.7px] text-ink-muted">{label}</div>
      <div className={`mt-1 text-[20px] font-extrabold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
