import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { demoMode } from "@/lib/data/repo";
import { ShieldIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/leads", label: "Leads" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/dashboard");

  if (demoMode()) {
    return (
      <div className="py-20">
        <div className="container-t max-w-lg text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/12 text-gold">
            <ShieldIcon size={26} />
          </span>
          <h1 className="mt-5 text-[24px] font-bold">Admin tools need a live database</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
            There&apos;s no seeded demo admin and nothing to moderate in demo mode.
            Connect Supabase to use venue verification, user moderation and the leads
            inbox.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="container-t grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Admin" className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4">
            <h2 className="text-[12px] font-bold uppercase tracking-[1.2px] text-ink-muted">
              Tempo ops
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              Trust, supply and matchday health.
            </p>
          </div>
          <ul className="flex gap-1.5 overflow-x-auto border-b border-glass-border pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-b-0 lg:pb-0">
            {TABS.map((t) => (
              <li key={t.href} className="shrink-0">
                <Link
                  href={t.href}
                  className="block whitespace-nowrap rounded-lg px-3 py-2 text-[14px] font-semibold text-ink-soft transition hover:bg-green/8 hover:text-green"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
