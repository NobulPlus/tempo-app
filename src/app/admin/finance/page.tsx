import { getFinanceSummary, listHostPayoutRequestsAdmin, listWalletsAdmin, listWalletTransactionsAdmin } from "@/lib/data/repo";
import { FinanceBoard } from "@/components/admin/finance-board";
import { HostPayoutBoard } from "@/components/admin/host-payout-board";

export default async function AdminFinancePage() {
  const [summary, wallets, transactions, hostPayoutRequests] = await Promise.all([
    getFinanceSummary(),
    listWalletsAdmin(),
    listWalletTransactionsAdmin(200),
    listHostPayoutRequestsAdmin(100),
  ]);

  return (
    <div>
      <h1 className="text-[26px] font-bold">Finance</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Visibility into wallet balances and money movement across every user.
        Pending Korapay top-ups can be rechecked here when a customer reports a successful payment.
      </p>

      <div className="mt-6">
        <FinanceBoard summary={summary} wallets={wallets} transactions={transactions} />
        <HostPayoutBoard requests={hostPayoutRequests} />
      </div>
    </div>
  );
}
