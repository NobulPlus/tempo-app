import { listIdentityVerificationsAdmin, getIdentityDocumentUrl } from "@/lib/data/repo";
import { IdentityReviewBoard } from "@/components/admin/identity-review-board";

export default async function AdminIdentityPage() {
  const verifications = await listIdentityVerificationsAdmin();
  const pending = verifications.filter((v) => v.status === "pending");

  const documentUrls = Object.fromEntries(
    await Promise.all(
      verifications.map(async (v) => [v.id, await getIdentityDocumentUrl(v.documentPath)] as const),
    ),
  );

  return (
    <div>
      <h1 className="text-[26px] font-bold">Identity verification</h1>
      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
        Review uploaded ID documents and approve or reject each submission. No phone
        or SMS verification yet — this is document review only.
      </p>
      <p className="mt-2 text-[13px] font-semibold text-gold">
        {pending.length === 0
          ? "Nothing waiting on review."
          : `${pending.length} submission${pending.length === 1 ? "" : "s"} waiting on review.`}
      </p>

      <div className="mt-6">
        <IdentityReviewBoard verifications={verifications} documentUrls={documentUrls} />
      </div>
    </div>
  );
}
