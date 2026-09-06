import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getIdentityVerification } from "@/lib/data/repo";
import { IdentityUploadForm } from "@/components/identity/identity-upload-form";
import { ShieldIcon, ClockIcon } from "@/components/icons";
import { formatRelativeDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your identity",
  robots: { index: false, follow: false },
};

export default async function VerifyIdentityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/verify-identity");

  const verification = await getIdentityVerification(user.id);

  return (
    <div className="py-12">
      <div className="container-t max-w-lg">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
          <ShieldIcon size={24} />
        </span>
        <h1 className="mt-4 font-display text-[clamp(24px,4.5vw,32px)] font-extrabold tracking-[-.02em]">
          Verify your identity
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          A quick document check builds trust with hosts, players and other venue
          owners. Optional, but verified accounts stand out.
        </p>

        {user.identityVerified ? (
          <p className="mt-6 flex items-center gap-2 rounded-lg border border-green/30 bg-green/10 px-4 py-3 text-[13.5px] text-green">
            <ShieldIcon size={15} />
            Your identity is verified.
          </p>
        ) : verification?.status === "pending" ? (
          <p className="mt-6 flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-[13.5px] text-gold">
            <ClockIcon size={15} />
            Submitted {formatRelativeDay(verification.createdAt)} — waiting on review.
          </p>
        ) : (
          <>
            {verification?.status === "rejected" && (
              <p className="mt-6 rounded-lg border border-orange/30 bg-orange/10 px-4 py-3 text-[13.5px] text-orange">
                Your last submission was rejected
                {verification.reviewNote ? `: "${verification.reviewNote}"` : "."} Try again below.
              </p>
            )}
            <div className="mt-6">
              <IdentityUploadForm />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
