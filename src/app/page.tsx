import Link from "next/link";
import { getPlatformStats, getUrgentGames, listPitches } from "@/lib/data/repo";
import { GameCard } from "@/components/match/game-card";
import { PitchCard } from "@/components/pitch/pitch-card";
import {
  SearchIcon,
  ArrowRightIcon,
  ShieldIcon,
  UsersIcon,
  GroupIcon,
  LightningIcon,
  PinIcon,
  CarIcon,
  FlameIcon,
} from "@/components/icons";
import { WaitlistForm } from "@/components/waitlist-form";

export const dynamic = "force-dynamic";

const AREAS = ["Lekki Phase 1", "Ikoyi", "Victoria Island", "Ikeja GRA", "Surulere", "Yaba"];

export default async function HomePage() {
  const [stats, urgent, topPitches] = await Promise.all([
    getPlatformStats(),
    getUrgentGames(3),
    listPitches({ sort: "rated" }),
  ]);

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative pb-16 pt-14 md:pb-24 md:pt-20">
        <div className="container-t grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div className="reveal-t">
            <span className="chip-t !border-green/30 !bg-green/10 !text-green">
              <ShieldIcon size={13} />
              {stats.verifiedVenues} verified venues across {stats.areas} Lagos areas
            </span>

            <h1 className="mt-5 text-[clamp(38px,7vw,58px)] font-extrabold leading-[1.05] tracking-[-.03em]">
              Play football
              <br />
              <span className="text-green">whenever you want</span>
            </h1>

            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              Find a pitch near you. Book it in under a minute. Or join an open game
              with players who actually show up.{" "}
              <span className="text-ink">Lagos football, finally organised.</span>
            </p>

            <form action="/pitches" className="mt-7 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
                  <PinIcon size={18} />
                </span>
                <input
                  name="q"
                  type="search"
                  placeholder="Where do you want to play?"
                  aria-label="Search by area or venue"
                  className="w-full rounded-full border border-white/12 bg-white/5 py-4 pl-12 pr-5 text-[15px] outline-none transition focus:border-green/50 focus:bg-white/7"
                />
              </div>
              <button type="submit" className="btn-t btn-green-t">
                <SearchIcon size={18} />
                Search
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {AREAS.map((a) => (
                <Link
                  key={a}
                  href={`/pitches?area=${encodeURIComponent(a)}`}
                  className="rounded-full border border-white/12 bg-white/4 px-4 py-2 text-[13.5px] text-ink-soft transition hover:border-green/35 hover:bg-green/8 hover:text-green"
                >
                  {a}
                </Link>
              ))}
            </div>
          </div>

          {/* Live rail — real games, real countdowns */}
          <div className="reveal-t">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <FlameIcon size={16} className="text-orange" />
                Kicking off soon
              </h2>
              <Link
                href="/games"
                className="flex items-center gap-1.5 text-[13.5px] font-semibold text-green transition hover:gap-2.5"
              >
                All games <ArrowRightIcon size={15} />
              </Link>
            </div>

            {urgent.length > 0 ? (
              <div className="grid gap-3">
                {urgent.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            ) : (
              <div className="card-t p-8 text-center text-ink-soft">
                No open games right now.{" "}
                <Link href="/host" className="font-semibold text-green">
                  Host one
                </Link>
                .
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= HONEST STATS ================= */}
      <section className="border-y border-white/8 bg-black/20 py-10">
        <div className="container-t grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat value={stats.verifiedVenues} label="Verified venues" hint="Visited and inspected in person" />
          <Stat value={stats.pitches} label="Bookable pitches" />
          <Stat value={stats.upcomingGames} label="Games this week" />
          <Stat value={stats.openSpots} label="Open spots right now" hint="Updates live" />
        </div>
        <p className="container-t mt-6 text-center text-[12.5px] text-ink-muted">
          Real numbers, counted from the database. We&apos;re early — and we&apos;d rather
          show you the truth than a made-up one.
        </p>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="py-20">
        <div className="container-t">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(28px,5vw,44px)] font-extrabold leading-tight tracking-[-.025em]">
              Find. <span className="text-green">Book.</span> Play.
            </h2>
            <p className="mt-3 text-[17px] text-ink-soft">
              Three steps from wanting to play to being on the pitch.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                k: "STEP 01",
                h: "Find",
                p: "Browse verified pitches sorted by actual distance from you, with live availability and the real price for that time slot.",
                Icon: PinIcon,
              },
              {
                k: "STEP 02",
                h: "Book",
                p: "Pick your hour and pay by card, transfer or USSD. Your slot is locked the moment payment clears — no double-bookings, ever.",
                Icon: LightningIcon,
              },
              {
                k: "STEP 03",
                h: "Play",
                p: "Turn up and play. Rate your teammates after. Your reputation follows you to every game you join.",
                Icon: UsersIcon,
              },
            ].map(({ k, h, p, Icon }) => (
              <article key={k} className="card-t card-t-hover relative overflow-hidden p-7">
                <span className="spokes-t" />
                <span className="relative grid h-12 w-12 place-items-center rounded-xl bg-green/12 text-green">
                  <Icon size={24} />
                </span>
                <div className="relative mt-5 text-[11.5px] font-bold tracking-[1.5px] text-green">
                  {k}
                </div>
                <h3 className="relative mt-1.5 text-[22px] font-bold">{h}</h3>
                <p className="relative mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHAT MAKES IT DIFFERENT ================= */}
      <section className="py-8 pb-20">
        <div className="container-t">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(28px,5vw,44px)] font-extrabold leading-tight tracking-[-.025em]">
              Built for the <span className="text-orange">beautiful game</span>
            </h2>
            <p className="mt-3 text-[17px] text-ink-soft">
              Every feature here exists because organising football in Lagos is harder
              than it should be.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                h: "No more locked gates",
                p: "Slots are held in the database with a constraint that makes double-booking physically impossible. If Tempo says it's yours, it's yours.",
                Icon: ShieldIcon,
                accent: "text-green",
              },
              {
                h: "Games that actually happen",
                p: "Every game shows how many players it needs to go ahead. Hit the number and it's guaranteed. Miss it and everyone is refunded automatically.",
                Icon: GroupIcon,
                accent: "text-orange",
              },
              {
                h: "Know who you're playing with",
                p: "Punctuality scores, peer ratings and traits — all earned from real games, never self-declared. No-shows have nowhere to hide.",
                Icon: UsersIcon,
                accent: "text-[#ce93d8]",
              },
              {
                h: "It knows Lagos traffic",
                p: "A 7pm kickoff in Lekki means leaving Yaba at 5. Tempo tells you when to leave, and warns you when a game is across the bridge.",
                Icon: CarIcon,
                accent: "text-blue",
              },
            ].map(({ h, p, Icon, accent }) => (
              <article key={h} className="card-t card-t-hover p-6">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-white/6 ${accent}`}>
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold leading-snug">{h}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TOP PITCHES ================= */}
      <section className="pb-20">
        <div className="container-t">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[clamp(26px,4vw,38px)] font-extrabold tracking-[-.025em]">
                Verified pitches <span className="text-green">in Lagos</span>
              </h2>
              <p className="mt-2 text-[16px] text-ink-soft">
                Every one visited in person before it went live.
              </p>
            </div>
            <Link
              href="/pitches"
              className="flex items-center gap-2 font-semibold text-green transition hover:gap-3"
            >
              View all <ArrowRightIcon size={18} />
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {topPitches.slice(0, 6).map((p) => (
              <PitchCard key={p.id} pitch={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= WAITLIST / CTA ================= */}
      <section className="pb-24">
        <div className="container-t">
          <div className="card-t relative overflow-hidden p-8 text-center md:p-14">
            <span className="spokes-t" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-[clamp(26px,4.5vw,40px)] font-extrabold tracking-[-.025em]">
                We&apos;re just getting started
              </h2>
              <p className="mt-4 text-[16.5px] leading-relaxed text-ink-soft">
                Tempo is live in Lekki, Ikoyi, Victoria Island, Onikan, Surulere, Ikeja
                GRA and Yaba. If your regular pitch isn&apos;t here yet, tell us where you
                play and we&apos;ll go and get it verified.
              </p>

              <div className="mt-8">
                <WaitlistForm />
              </div>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/games" className="btn-t btn-green-t">
                  Find a game
                </Link>
                <Link href="/host" className="btn-t btn-ghost-t">
                  Host a game
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label, hint }: { value: number; label: string; hint?: string }) {
  return (
    <div className="text-center">
      <div className="text-[clamp(28px,5vw,40px)] font-extrabold tabular-nums text-green">
        {value}
      </div>
      <div className="mt-1 text-[14px] font-medium">{label}</div>
      {hint && <div className="mt-0.5 text-[12px] text-ink-muted">{hint}</div>}
    </div>
  );
}
