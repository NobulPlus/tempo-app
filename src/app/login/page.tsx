import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listProfiles, demoMode } from "@/lib/data/repo";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/url";
import { DemoSignIn } from "@/components/auth/demo-signin";
import { LoginForm } from "@/components/auth/login-form";
import { TempoMark, CheckIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  const { next: rawNext, verified } = await searchParams;
  const next = safeNext(rawNext);
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

          {verified === "1" && (
            <div className="relative mt-6 flex items-center gap-3 rounded-xl border border-green/30 bg-green/10 px-4 py-3 text-left">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green/20 text-green">
                <CheckIcon size={16} />
              </span>
              <p className="text-[13.5px] text-ink">
                Email verified. Sign in to continue.
              </p>
            </div>
          )}

          <div className="relative mt-7">
            {isDemo ? <DemoSignIn profiles={profiles} next={next} /> : <LoginForm next={next} />}
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
