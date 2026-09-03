import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getWalletBalance, getWalletTransactions } from "@/lib/data/repo";
import { formatNaira, formatDayShort, formatTime } from "@/lib/format";
import { TopupForm } from "@/components/wallet/topup-form";
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
  const [balanceKobo, transactions] = await Promise.all([
    getWalletBalance(user.id),
    getWalletTransactions(user.id),
  ]);

  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <h1 className="font-display text-[clamp(26px,4.5vw,36px)] font-extrabold tracking-[-.02em]">
          Your wallet
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Top up, book pitches, and get instant credit back on eligible cancellations.
        </p>

        {topup === "success" && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-[13.5px] text-green">
            <CheckIcon size={15} />
            Top-up successful — your balance is updated below.
          </p>
        )}
        {topup === "error" && (
          <p className="mt-4 flex items-center gap-2 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
            <CloseIcon size={15} />
            {reason || "That top-up didn't go through — nothing was charged."}
          </p>
        )}

        <div className="mt-6 card-t flex items-center gap-4 p-6 md:p-7">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-green/12 text-green">
            <WalletIcon size={24} />
          </span>
          <div>
            <div className="text-[12px] text-ink-muted">Available balance</div>
            <div className="text-[32px] font-extrabold tracking-[-.02em]">{formatNaira(balanceKobo)}</div>
          </div>
        </div>

        <div className="mt-6">
          <TopupForm />
        </div>

        <section className="mt-10">
          <h2 className="text-[18px] font-bold">Transaction history</h2>
          {transactions.length === 0 ? (
            <div className="card-t mt-4 p-6 text-center text-[14px] text-ink-soft">
              Nothing here yet — top up to get started.
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

function TransactionRow({ txn }: { txn: WalletTransaction }) {
  const isCredit = txn.amountKobo >= 0;
  const label =
    txn.type === "topup"
      ? "Wallet top-up"
      : txn.type === "booking_payment"
        ? "Pitch booking"
        : "Cancellation credit";

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
