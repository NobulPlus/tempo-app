import type { Metadata } from "next";
import { demoMode } from "@/lib/data/repo";
import { ResetRequestForm } from "@/components/auth/reset-request-form";
import { TempoMark, LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  const isDemo = demoMode();

  return (
    <div className="grid min-h-[calc(100vh-71px)] place-items-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="card-t relative overflow-hidden p-8">
          <span className="spokes-t" />

          <div className="relative text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#00e676] to-[#00c853]">
              <TempoMark size={30} className="text-[#06210f]" />
            </span>
            <h1 className="mt-4 text-[26px] font-extrabold">Reset your password</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              Enter your email and we&apos;ll send you a link to set a new one
            </p>
          </div>

          <div className="relative mt-7">
            {isDemo ? (
              <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 px-5 py-4 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/20 text-gold">
                  <LockIcon size={17} />
                </span>
                <p className="text-[14px] text-ink">
                  This deploy is running in demo mode — sign in as a seeded player from
                  the login page instead of resetting a password.
                </p>
              </div>
            ) : (
              <ResetRequestForm />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
