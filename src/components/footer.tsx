import Link from "next/link";
import { TempoMark } from "./icons";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "PLATFORM",
    links: [
      { label: "Find Pitches", href: "/pitches" },
      { label: "Join a Game", href: "/games" },
      { label: "Host a Game", href: "/host" },
      { label: "Players", href: "/players" },
    ],
  },
  {
    title: "VENUES",
    links: [
      { label: "Partner with Us", href: "/partner" },
      { label: "Venue Dashboard", href: "/venue" },
      { label: "How verification works", href: "/verification" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Cancellations & Refunds", href: "/legal/refunds" },
      { label: "Community Rules", href: "/legal/community" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/8 bg-black/20 py-14">
      <div className="container-t">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-gradient-to-br from-[#00e676] to-[#00c853]">
                <TempoMark size={20} className="text-[#06210f]" />
              </span>
              <span className="text-[22px] font-extrabold tracking-[0.5px] text-green">
                TEMPO
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
              The layer between recreational players and sports facilities in Lagos.
              Find a pitch, book a pitch, join a game.
            </p>
            <p className="mt-4 text-[13px] text-ink-muted">
              Registered in Nigeria. Payments processed by Paystack.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-[12px] font-bold tracking-[1.2px] text-ink-muted">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[14.5px] text-ink-soft transition hover:text-green"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/8 pt-6 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {new Date().getFullYear()} Tempo. Built in Lagos, Nigeria by Paul Adeleye.
          </div>
          <div className="flex gap-5">
            <Link href="/legal/terms" className="transition hover:text-ink-soft">
              Terms
            </Link>
            <Link href="/legal/privacy" className="transition hover:text-ink-soft">
              Privacy
            </Link>
            <a href="mailto:hello@tempo.ng" className="transition hover:text-ink-soft">
              hello@tempo.ng
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
