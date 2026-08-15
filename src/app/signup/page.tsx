import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { TempoMark } from "@/components/icons";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Join Tempo to book verified pitches and play football across Lagos with people who show up.",
};

export default function SignupPage() {
  return (
    <div className="grid min-h-[calc(100vh-71px)] place-items-center px-6 py-14">
      <div className="w-full max-w-lg">
        <div className="card-t relative overflow-hidden p-8">
          <span className="spokes-t" />

          <div className="relative text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#00e676] to-[#00c853]">
              <TempoMark size={30} className="text-[#06210f]" />
            </span>
            <h1 className="mt-4 text-[26px] font-extrabold">Join Tempo</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              Create your account and start playing
            </p>
          </div>

          <div className="relative mt-7">
            <SignupForm />
          </div>

          <p className="relative mt-6 border-t border-white/8 pt-5 text-center text-[14px] text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-green">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
