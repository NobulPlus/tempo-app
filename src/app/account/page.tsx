import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMyPhone } from "@/lib/data/repo";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { ProfilePhotoForm } from "@/components/account/profile-photo-form";
import { ProfileDetailsForm } from "@/components/account/profile-details-form";
import { PhoneForm } from "@/components/account/phone-form";
import { UserIcon, MailIcon, ShieldIcon } from "@/components/icons";
import Link from "next/link";

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
      <div className="container-t max-w-5xl">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
          <UserIcon size={24} />
        </span>
        <h1 className="mt-4 font-display text-[clamp(24px,4.5vw,32px)] font-extrabold tracking-[-.02em]">
          Your account
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-ink-soft">
          Your personal details, public player profile and account contact information.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
          <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <ProfilePhotoForm fullName={user.fullName} initials={user.initials} avatarUrl={user.avatarUrl} />

            <section className="card-t p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold uppercase tracking-[.7px] text-ink-muted">Tempo profile</div>
                  <div className="mt-1 truncate text-[13.5px] text-ink-soft">
                    @{user.handle} · {user.role.replace("_", " ")}
                  </div>
                </div>
                <Link
                  href={`/players/${user.handle}`}
                  className="shrink-0 text-[12.5px] font-semibold text-green transition hover:opacity-80"
                >
                  View public →
                </Link>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-glass-border pt-4 text-[12.5px] text-ink-muted">
                <ShieldIcon size={14} className={user.identityVerified ? "text-green" : "text-gold"} />
                {user.identityVerified ? "Identity verified" : "Identity verification pending"}
              </div>

              {email && (
                <div className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-muted">
                  <MailIcon size={14} className="text-ink-muted" />
                  <span className="truncate">{email}</span>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-5">
            <ProfileDetailsForm player={user} />
            <PhoneForm phone={phone} />
          </div>
        </div>
      </div>
    </div>
  );
}
