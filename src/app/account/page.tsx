import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ProfilePhotoForm } from "@/components/account/profile-photo-form";
import { UserIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="py-12">
      <div className="container-t max-w-lg">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
          <UserIcon size={24} />
        </span>
        <h1 className="mt-4 font-display text-[clamp(24px,4.5vw,32px)] font-extrabold tracking-[-.02em]">
          Your account
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          Update the photo shown on your public player profile.
        </p>

        <div className="mt-6">
          <ProfilePhotoForm fullName={user.fullName} initials={user.initials} avatarUrl={user.avatarUrl} />
        </div>
      </div>
    </div>
  );
}
