import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMyPhone } from "@/lib/data/repo";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { ProfilePhotoForm } from "@/components/account/profile-photo-form";
import { ProfileDetailsForm } from "@/components/account/profile-details-form";
import { PhoneForm } from "@/components/account/phone-form";
import { UserIcon, MailIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [phone, email] = await Promise.all([
    getMyPhone(user.id),
    isSupabaseConfigured()
      ? createClient().then(async (sb) => (await sb.auth.getUser()).data.user?.email ?? null)
      : Promise.resolve(null),
  ]);

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
          View and update the details on your Tempo profile.
        </p>

        {email && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-glass-border bg-glass px-4 py-3 text-[13.5px] text-ink-soft">
            <MailIcon size={15} className="text-ink-muted" />
            {email}
            <span className="ml-auto text-[11.5px] text-ink-muted">Sign-in email</span>
          </div>
        )}

        <div className="mt-6 space-y-5">
          <ProfilePhotoForm fullName={user.fullName} initials={user.initials} avatarUrl={user.avatarUrl} />
          <ProfileDetailsForm player={user} />
          <PhoneForm phone={phone} />
        </div>
      </div>
    </div>
  );
}
