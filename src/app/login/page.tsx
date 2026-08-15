import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listProfiles, demoMode } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/session";
import { DemoSignIn } from "@/components/auth/demo-signin";
import { TempoMark, MailIcon, LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/dashboard" } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next);

  const isDemo = demoMode();
  const profiles = isDemo ? await listProfiles() : [];

  return (
    <div className="grid min-h-[calc(100vh-71px)] place-items-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="card-t relative overflow-hidden p-8">
          <span className="spokes-t" />

          <div className="relative text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#00e676] to-[#00c853]">
              <TempoMark size={30} className="text-[#06210f]" />
            </span>
            <h1 className="mt-4 text-[26px] font-extrabold">Welcome back</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              Sign in to book pitches and join games
            </p>
          </div>

          <div className="relative mt-7">
            {isDemo ? (
              <DemoSignIn profiles={profiles} next={next} />
            ) : (
              <form className="space-y-4">
                <div className="field-t">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder=" "
                  />
                  <span className="field-icon">
                    <MailIcon size={19} />
                  </span>
                  <label htmlFor="email" className="floating">
                    Email
                  </label>
                </div>

                <div className="field-t">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="current-password"
                    placeholder=" "
                  />
                  <span className="field-icon">
                    <LockIcon size={19} />
                  </span>
                  <label htmlFor="password" className="floating">
                    Password
                  </label>
                </div>

                <button type="submit" className="btn-t btn-green-t w-full">
                  Sign in
                </button>

                <Link
                  href="/reset"
                  className="block text-center text-[13.5px] text-ink-soft transition hover:text-green"
                >
                  Forgot your password?
                </Link>
              </form>
            )}
          </div>

          <p className="relative mt-7 border-t border-white/8 pt-5 text-center text-[14px] text-ink-soft">
            New to Tempo?{" "}
            <Link href="/signup" className="font-semibold text-green">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
