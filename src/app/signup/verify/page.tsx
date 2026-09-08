import type { Metadata } from "next";
import Link from "next/link";
import { SignupOtpForm } from "@/components/auth/signup-otp-form";
import { TempoMark } from "@/components/icons";
import { safeNext } from "@/lib/url";

export const metadata: Metadata = {
  title: "Verify your account",
  description: "Enter the code from your email to finish creating your Tempo account.",
  robots: { index: false, follow: false },
};

export default async function SignupVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email = "", next } = await searchParams;
  const safeDestination = safeNext(next || "/dashboard");

  return (
    <div className="grid min-h-[calc(100vh-71px)] place-items-center px-6 py-14">
      <div className="w-full max-w-lg">
        <div className="card-t relative overflow-hidden p-8">
          <span className="spokes-t" />

          <div className="relative text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#00e676] to-[#00c853]">
              <TempoMark size={30} className="text-[#06210f]" />
            </span>
            <h1 className="mt-4 text-[26px] font-extrabold">Enter your code</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              Finish your signup with the code sent to your inbox.
            </p>
          </div>

          <div className="relative mt-7">
            <SignupOtpForm email={email} next={safeDestination} />
          </div>

          <p className="relative mt-6 border-t border-white/8 pt-5 text-center text-[14px] text-ink-soft">
            Already verified?{" "}
            <Link href="/login" className="font-semibold text-green">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
