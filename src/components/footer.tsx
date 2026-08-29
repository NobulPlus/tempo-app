import Link from "next/link";
import { TempoMark } from "./icons";
import { listAreas, listPitches } from "@/lib/data/repo";

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

/** Footy-Addicts-style "play football in [area]" link block, area-based. */
async function AreaLinks() {
  const areas = await listAreas();
  const byArea = await Promise.all(areas.map((area) => listPitches({ area })));

  return (
    <div className="band-t border-t border-glass-border py-14">
      <div className="container-t">
        <h4 className="mb-6 font-display text-[13px] font-bold tracking-[1.2px] text-ink-muted">
          PLAY FOOTBALL BY AREA
        </h4>
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {areas.map((area, i) => (
            <div key={area}>
              <div className="mb-2.5 text-[13.5px] font-bold text-ink">Play football in {area}</div>
              <ul className="flex flex-col gap-1.5">
                {byArea[i].slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/pitches/${p.slug}`}
                      className="text-[13px] text-ink-soft transition hover:text-green"
                    >
                      {p.venue.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export async function Footer() {
  return (
    <footer className="mt-24 border-t border-glass-border">
      <AreaLinks />

      <div className="container-t py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-green">
                <TempoMark size={20} className="text-[#051530]" />
              </span>
              <span className="font-display text-[22px] font-extrabold tracking-[0.3px] text-green">
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

        <div className="mt-12 flex flex-col gap-3 border-t border-glass-border pt-6 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {new Date().getFullYear()} Tempo.
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
