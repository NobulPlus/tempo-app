import Link from "next/link";

const PAGES = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/refunds", label: "Cancellations & Refunds" },
  { href: "/legal/community", label: "Community Rules" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-12">
      <div className="container-t grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Legal pages" className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-3 text-[12px] font-bold tracking-[1.2px] text-ink-muted">
            LEGAL
          </h2>
          <ul className="space-y-1">
            {PAGES.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="block rounded-lg px-3 py-2 text-[14px] text-ink-soft transition hover:bg-white/5 hover:text-green"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <article className="legal-prose max-w-3xl">{children}</article>
      </div>
    </div>
  );
}
