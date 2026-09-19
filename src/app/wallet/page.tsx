import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getHostPayoutOverview, getWalletBalance, getWalletTransactions } from "@/lib/data/repo";
import { HostPayoutPanel } from "@/components/wallet/host-payout-panel";
import { formatNaira, formatDayShort, formatTime } from "@/lib/format";
import { WalletIcon, CheckIcon, ClockIcon, CloseIcon } from "@/components/icons";
import type { WalletTransaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wallet",
  robots: { index: false, follow: false },
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string; reason?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");

  const { topup, reason } = await searchParams;
  const [balanceKobo, transactions, payoutOverview] = await Promise.all([
    getWalletBalance(user.id),
    getWalletTransactions(user.id),
    getHostPayoutOverview(user.id),
  ]);

  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <h1 className="font-display text-[clamp(26px,4.5vw,36px)] font-extrabold tracking-[-.02em]">
          Your wallet
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Your Tempo credit ledger for refunds, reimbursements and hosting earnings.
        </p>

        {topup === "success" && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-[13.5px] text-green">
            <CheckIcon size={15} />
            Payment successful — your ledger is updated below.
          </p>
        )}
        {topup === "error" && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
            <CloseIcon size={15} />
            {reason || "That payment didn't go through — nothing was applied."}
          </p>
        )}

        <div className="mt-6 card-t flex items-center gap-4 p-6 md:p-7">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/12 text-green">
            <WalletIcon size={24} />
          </span>
          <div>
            <div className="text-[12px] text-ink-muted">Available credit</div>
            <div className="text-[32px] font-extrabold tracking-[-.02em]">{formatNaira(balanceKobo)}</div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/4 p-5 text-[13.5px] leading-relaxed text-ink-soft">
          Payments now start from the booking or game you are paying for. This page only shows reusable credit from refunds,
          reimbursements and hosting earnings.
        </div>

        <HostPayoutPanel
          bankAccount={payoutOverview.bankAccount}
          requests={payoutOverview.requests}
          withdrawableKobo={payoutOverview.withdrawableKobo}
        />

        <section className="mt-10">
          <h2 className="text-[18px] font-bold">Transaction history</h2>
          {transactions.length === 0 ? (
            <div className="card-t mt-4 p-6 text-center text-[14px] text-ink-soft">
              Nothing here yet. Credits and payment ledger entries will appear here.
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {transactions.map((t) => (
                <TransactionRow key={t.id} txn={t} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

const TXN_LABELS: Record<WalletTransaction["type"], string> = {
  topup: "Wallet top-up",
  booking_payment: "Pitch booking",
  cancellation_credit: "Cancellation credit",
  game_payment: "Game payment",
  game_refund: "Game refund",
  host_game_deposit: "Pitch deposit (hosting)",
  host_reimbursement: "Hosting reimbursement",
  host_game_earnings: "Hosting earnings",
  host_withdrawal: "Host payout request",
  host_withdrawal_reversal: "Host payout restored",
};

function TransactionRow({ txn }: { txn: WalletTransaction }) {
  const isCredit = txn.amountKobo >= 0;
  const label = TXN_LABELS[txn.type];

  return (
    <li className="card-t flex items-center gap-4 p-4">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          txn.status === "pending"
            ? "bg-gold/12 text-gold"
            : isCredit
              ? "bg-green/12 text-green"
              : "bg-white/6 text-ink-soft"
        }`}
      >
        {txn.status === "pending" ? <ClockIcon size={17} /> : <WalletIcon size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold">{label}</div>
        <div className="truncate text-[12px] text-ink-muted">
          {formatDayShort(txn.createdAt)} · {formatTime(txn.createdAt)}
          {txn.status === "pending" && " · Pending"}
        </div>
      </div>
      <div className={`shrink-0 text-[15px] font-bold ${isCredit ? "text-green" : ""}`}>
        {isCredit ? "+" : "−"}
        {formatNaira(Math.abs(txn.amountKobo))}
      </div>
    </li>
  );
}
