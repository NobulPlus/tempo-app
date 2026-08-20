import Link from "next/link";
import Image from "next/image";
import { getPlatformStats, getUrgentGames, listPitches } from "@/lib/mock";
import { testimonials } from "@/lib/mock/testimonials";
import { GameCard } from "@/components/match/game-card";
import { PitchCard } from "@/components/pitch/pitch-card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { StepBadge } from "@/components/ui/step-badge";
import {
  SearchIcon,
  ArrowRightIcon,
  ShieldIcon,
  UsersIcon,
  GroupIcon,
  PinIcon,
  CarIcon,
  FlameIcon,
  DoodleFindIcon,
  DoodleBookIcon,
  DoodlePlayIcon,
} from "@/components/icons";
import { WaitlistForm } from "@/components/waitlist-form";

const AREAS = ["Lekki Phase 1", "Ikoyi", "Victoria Island", "Ikeja GRA", "Surulere", "Yaba"];

export default function HomePage() {
  const stats = getPlatformStats();
  const urgent = getUrgentGames(2);
  const topPitches = listPitches({ sort: "rated" });

  return (
    <>
      {/* ================= HERO — editorial photo, Footy-Addicts energy ================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          {/* Looping pitch footage — hidden for prefers-reduced-motion, which gets the static frame instead */}
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="https://assets.mixkit.co/videos/43484/43484-thumb-720-0.jpg"
            className="hidden h-full w-full object-cover motion-safe:block"
          >
            <source src="https://assets.mixkit.co/videos/43484/43484-720.mp4" type="video/mp4" />
          </video>
          <Image
            src="https://assets.mixkit.co/videos/43484/43484-thumb-720-0.jpg"
            alt=""
            fill
            unoptimized
            priority
            className="hidden object-cover motion-reduce:block"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-bg-primary/80 via-bg-primary/75 to-bg-primary" />
        </div>

        <div className="container-t relative grid items-end gap-12 pb-16 pt-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-24 lg:pt-28">
          <div className="reveal-t">
            <span className="chip-t !border-green/30 !bg-green/10 !text-green">
              <ShieldIcon size={13} />
              {stats.verifiedVenues} verified venues across {stats.areas} Lagos areas
            </span>

            <h1 className="mt-5 font-display text-[clamp(40px,7.5vw,64px)] font-extrabold leading-[0.98] tracking-[-.02em]">
              Play football
              <br />
              <span className="text-green">whenever you want</span>
            </h1>

            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              Find a pitch near you. Book it in under a minute. Or join an open game
              with players who actually show up.{" "}
              <span className="font-accent text-[22px] text-ink">
                Lagos football, finally organised.
              </span>
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
                  className="w-full rounded-full border border-glass-border bg-bg-card py-4 pl-12 pr-5 text-[15px] outline-none transition focus:border-green/50"
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
                  className="rounded-full border border-glass-border bg-bg-card px-4 py-2 text-[13.5px] text-ink-soft transition hover:border-green/35 hover:bg-green/8 hover:text-green"
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

      {/* ================= HONEST STATS — Footy Addicts' "The Stats Never Lie" ================= */}
      <section className="band-t border-y border-glass-border py-12">
        <div className="container-t">
          <p className="mb-8 text-center font-display text-[13px] font-bold tracking-[2px] text-ink-muted">
            THE NUMBERS NEVER LIE
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Stat value={stats.verifiedVenues} label="Verified venues" hint="Visited and inspected in person" />
            <Stat value={stats.pitches} label="Bookable pitches" />
            <Stat value={stats.upcomingGames} label="Games this week" />
            <Stat value={stats.openSpots} label="Open spots right now" hint="Updates live" />
          </div>
        </div>
        <p className="container-t mt-8 text-center text-[12.5px] text-ink-muted">
          Real numbers, counted from the database. We&apos;re early — and we&apos;d rather
          show you the truth than a made-up one.
        </p>
      </section>

      {/* ================= HOW IT WORKS — numbered steps, Playtomic pattern ================= */}
      <section className="py-20">
        <div className="container-t">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[clamp(28px,5vw,44px)] font-extrabold leading-tight tracking-[-.02em]">
              Find. <span className="text-green">Book.</span> Play.
            </h2>
            <p className="mt-3 text-[17px] text-ink-soft">
              Three steps from wanting to play to being on the pitch.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                n: 1,
                h: "Find",
                p: "Browse verified pitches sorted by actual distance from you, with the real price for that time slot.",
                Icon: DoodleFindIcon,
              },
              {
                n: 2,
                h: "Book",
                p: "Pick your hour and pay by card, transfer or USSD. Your slot is locked the moment payment clears — no double-bookings, ever.",
                Icon: DoodleBookIcon,
              },
              {
                n: 3,
                h: "Play",
                p: "Turn up and play. Rate your teammates after. Your reputation follows you to every game you join.",
                Icon: DoodlePlayIcon,
              },
            ].map(({ n, h, p, Icon }) => (
              <article key={n} className="card-t p-7">
                <div className="flex items-center gap-3">
                  <StepBadge n={n} />
                  <Icon size={30} className="text-green/70" />
                </div>
                <h3 className="mt-5 font-display text-[22px] font-bold">{h}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHAT MAKES IT DIFFERENT ================= */}
      <section className="band-t py-20">
        <div className="container-t">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[clamp(28px,5vw,44px)] font-extrabold leading-tight tracking-[-.02em]">
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
                p: "Slots are held with a constraint that makes double-booking physically impossible. If Tempo says it's yours, it's yours.",
                Icon: ShieldIcon,
                accent: "text-green",
              },
              {
                h: "Games that actually happen",
                p: "Every game shows how many players it needs to go ahead. Hit the number and it's guaranteed.",
                Icon: GroupIcon,
                accent: "text-orange",
              },
              {
                h: "Know who you're playing with",
                p: "Punctuality scores, peer ratings and traits — all earned from real games, never self-declared.",
                Icon: UsersIcon,
                accent: "text-purple",
              },
              {
                h: "It knows Lagos traffic",
                p: "A 7pm kickoff in Lekki means leaving Yaba at 5. Tempo tells you when to leave, and warns you when a game is across the bridge.",
                Icon: CarIcon,
                accent: "text-blue",
              },
            ].map(({ h, p, Icon, accent }) => (
              <article key={h} className="card-t card-t-hover p-6">
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-glass ${accent}`}>
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
      <section className="py-20">
        <div className="container-t">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-[clamp(26px,4vw,38px)] font-extrabold tracking-[-.02em]">
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

      {/* ================= TESTIMONIALS — Footy Addicts pattern ================= */}
      <section className="band-t py-20">
        <div className="container-t">
          <p className="text-center font-display text-[13px] font-bold tracking-[2px] text-orange">
            REVIEWS
          </p>
          <h2 className="mt-2 text-center font-display text-[clamp(26px,4vw,38px)] font-extrabold tracking-[-.02em]">
            What the community has to say
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {testimonials.map((t) => (
              <TestimonialCard key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= WAITLIST / CTA ================= */}
      <section className="py-24">
        <div className="container-t">
          <div className="card-t relative overflow-hidden p-8 text-center md:p-14">
            <span className="spokes-t" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-[clamp(26px,4.5vw,40px)] font-extrabold tracking-[-.02em]">
                We&apos;re just getting started
              </h2>
              <p className="mt-4 text-[16.5px] leading-relaxed text-ink-soft">
                Tempo is live in Lekki, Ikoyi, Victoria Island, Lagos Island, Surulere, Ikeja
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
      <div className="font-display text-[clamp(30px,5.5vw,44px)] font-extrabold tabular-nums text-green">
        {value}
        <span className="text-orange">+</span>
      </div>
      <div className="mt-1 text-[14px] font-medium">{label}</div>
      {hint && <div className="mt-0.5 text-[12px] text-ink-muted">{hint}</div>}
    </div>
  );
}
