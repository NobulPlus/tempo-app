import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { ResetConfirmForm } from "@/components/auth/reset-confirm-form";
import { TempoMark, ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default async function ResetConfirmPage() {
  // Reached only via a verified recovery link (/auth/confirm establishes the
  // session before redirecting here) — no session means an expired or
  // already-used link, not something this page can recover from itself.
  const user = await getCurrentUser();

  return (
    <div className="grid min-h-[calc(100vh-71px)] place-items-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="card-t relative overflow-hidden p-8">
          <span className="spokes-t" />

          <div className="relative text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#00e676] to-[#00c853]">
              <TempoMark size={30} className="text-[#06210f]" />
            </span>
            <h1 className="mt-4 text-[26px] font-extrabold">
              {user ? "Set a new password" : "That link has expired"}
            </h1>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              {user
                ? `Signed in as ${user.fullName}`
                : "Reset links only work once, and expire after a while."}
            </p>
          </div>

          <div className="relative mt-7">
            {user ? (
              <ResetConfirmForm />
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-orange/30 bg-orange/10 px-5 py-4 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-orange/20 text-orange">
                  <ShieldIcon size={17} />
                </span>
                <p className="text-[14px] text-ink">
                  <Link href="/reset" className="font-semibold text-green">
                    Request a new reset link
                  </Link>{" "}
                  and try again.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
