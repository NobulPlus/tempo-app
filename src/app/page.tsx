import Link from "next/link";
import Image from "next/image";
import { getPlatformStats, getUrgentGames, listPitches } from "@/lib/data/repo";
import { formatNaira } from "@/lib/format";
import { testimonials } from "@/lib/mock/testimonials";
import { GameCard } from "@/components/match/game-card";
import { PitchCard } from "@/components/pitch/pitch-card";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { StepBadge } from "@/components/ui/step-badge";
import { Reveal } from "@/components/ui/reveal";
import {
  SearchIcon,
  ArrowRightIcon,
  ShieldIcon,
  UsersIcon,
  GroupIcon,
  PinIcon,
  StarIcon,
  CarIcon,
  FlameIcon,
  DoodleFindIcon,
  DoodleBookIcon,
  DoodlePlayIcon,
} from "@/components/icons";
import { WaitlistForm } from "@/components/waitlist-form";

export const dynamic = "force-dynamic";

const AREAS = ["Lekki Phase 1", "Ikoyi", "Victoria Island", "Ikeja GRA", "Surulere", "Yaba"];

export default async function HomePage() {
  const [stats, urgent, topPitches] = await Promise.all([
    getPlatformStats(),
    getUrgentGames(2),
    listPitches({ sort: "rated" }),
  ]);

  return (
    <>
      {/* ================= HERO — editorial photo, Footy-Addicts energy ================= */}
      <section className="relative overflow-hidden">
        <div className="grain-t absolute inset-0">
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
              Play sports
              <br />
              <span className="text-green">whenever you want</span>
            </h1>

            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
              Find a facility near you. Book it in under a minute. Or join an open game
              with players who actually show up.
              <span className="font-accent mt-2 block text-[22px] text-ink">
                Lagos sport, finally organised.
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
                Starting soon
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

      {/* ================= AREA TICKER — decorative, reinforces citywide coverage ================= */}
      <div className="marquee-t band-t border-y border-glass-border py-3">
        <div className="marquee-t-track">
          {[...AREAS, ...AREAS].map((a, i) => (
            <span
              key={`${a}-${i}`}
              className="flex items-center gap-3 px-6 text-[13px] font-bold tracking-[1.5px] text-ink-muted"
            >
              {a.toUpperCase()}
              <span className="text-green">●</span>
            </span>
          ))}
        </div>
      </div>

      {/* ================= HONEST STATS — Footy Addicts' "The Stats Never Lie" ================= */}
      <section className="band-t relative overflow-hidden border-b border-glass-border py-12">
        <span
          aria-hidden
          className="ghost-number-t left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {stats.verifiedVenues}
        </span>
        <div className="container-t relative">
          <p className="mb-8 text-center font-display text-[13px] font-bold tracking-[2px] text-ink-muted">
            THE NUMBERS NEVER LIE
          </p>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: stats.verifiedVenues, label: "Verified venues", hint: "Visited and inspected in person" },
              { value: stats.pitches, label: "Bookable facilities" },
              { value: stats.upcomingGames, label: "Games this week" },
              { value: stats.openSpots, label: "Open spots right now", hint: "Updates live" },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <Stat {...s} />
              </Reveal>
            ))}
          </div>
        </div>
        <p className="container-t relative mt-8 text-center text-[12.5px] text-ink-muted">
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
              Three steps from wanting to play to being out there.
            </p>
          </div>

          <div className="relative mt-12">
            {/* Journey line — runs through the step badges, connecting the 3 cards. */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-[16.6667%] right-[16.6667%] top-[49px] hidden md:block"
            >
              <svg className="w-full overflow-visible" height="2">
                <line
                  x1="0"
                  y1="1"
                  x2="100%"
                  y2="1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="1 10"
                  strokeLinecap="round"
                  className="text-green/30"
                />
              </svg>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {[
                {
                  n: 1,
                  h: "Find",
                  p: "Browse verified facilities sorted by actual distance from you, with the real price for that time slot.",
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
              ].map(({ n, h, p, Icon }, i) => (
                <Reveal key={n} as="article" delay={i * 130} className="card-t relative z-10 p-7">
                  <div className="flex items-center gap-3">
                    <StepBadge n={n} />
                    <Icon size={30} className="text-green/70" />
                  </div>
                  <h3 className="mt-5 font-display text-[22px] font-bold">{h}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{p}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= WHAT MAKES IT DIFFERENT ================= */}
      <section className="band-t py-20">
        <div className="container-t">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-[clamp(28px,5vw,44px)] font-extrabold leading-tight tracking-[-.02em]">
              Built for <span className="text-orange">how Lagos plays</span>
            </h2>
            <p className="mt-3 text-[17px] text-ink-soft">
              Every feature here exists because organising sport in Lagos is harder
              than it should be.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
            {/* Featured tile — the strongest hook gets a bento-style spotlight
                instead of sitting in a uniform 4-up row with the rest. */}
            <Reveal
              as="article"
              className="card-t card-t-hover relative flex flex-col justify-center overflow-hidden p-7 sm:col-span-2 lg:col-span-2 lg:row-span-2"
            >
              <span className="spokes-t" />
              <GroupIcon
                size={220}
                className="pointer-events-none absolute -bottom-10 -right-10 text-orange/[0.05]"
              />
              <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-orange/12 text-orange">
                <GroupIcon size={28} />
              </span>
              <h3 className="text-gradient-brand relative mt-6 font-display text-[26px] font-extrabold leading-snug">
                Games that actually happen
              </h3>
              <p className="relative mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
                Every game shows how many players it needs to go ahead. Hit the number
                and it&apos;s guaranteed.
              </p>
            </Reveal>

            {[
              {
                h: "No more locked gates",
                p: "Slots are held with a constraint that makes double-booking physically impossible. If Tempo says it's yours, it's yours.",
                Icon: ShieldIcon,
                accent: "text-green",
                span: "",
              },
              {
                h: "Know who you're playing with",
                p: "Punctuality scores, peer ratings and traits — all earned from real games, never self-declared.",
                Icon: UsersIcon,
                accent: "text-purple",
                span: "",
              },
              {
                h: "It knows Lagos traffic",
                p: "A 7pm start in Lekki means leaving Yaba at 5. Tempo tells you when to leave, and warns you when a game is across the bridge.",
                Icon: CarIcon,
                accent: "text-blue",
                span: "sm:col-span-2 lg:col-span-2",
              },
            ].map(({ h, p, Icon, accent, span }, i) => (
              <Reveal as="article" key={h} delay={(i + 1) * 90} className={`card-t card-t-hover p-6 ${span}`}>
                <span className={`grid h-11 w-11 place-items-center rounded-xl bg-glass ${accent}`}>
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold leading-snug">{h}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{p}</p>
              </Reveal>
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
                Verified venues <span className="text-green">in Lagos</span>
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

          {topPitches.length > 0 && (
            <>
              {/* Spotlight — the #1 rated pitch gets pulled out of the grid
                  instead of sitting as just another uniform card. */}
              <Reveal
                as="article"
                className="card-t card-t-hover relative mt-8 overflow-hidden lg:grid lg:grid-cols-[1.3fr_1fr]"
              >
                <div className="relative h-[220px] overflow-hidden bg-bg-elevated lg:h-full">
                  {topPitches[0].venue.photos[0] && (
                    <Image
                      src={topPitches[0].venue.photos[0]}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(min-width: 1024px) 55vw, 100vw"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent lg:bg-gradient-to-r" />
                  <span className="absolute left-4 top-4">
                    <span className="chip-t !border-gold/35 !bg-black/40 !text-gold">
                      <StarIcon size={12} />
                      Top rated
                    </span>
                  </span>
                </div>
                <div className="flex flex-col justify-center p-7">
                  <div className="flex items-center gap-1.5 text-[13.5px] text-ink-soft">
                    <PinIcon size={14} />
                    {topPitches[0].venue.area}
                  </div>
                  <h3 className="mt-1.5 font-display text-[26px] font-extrabold">
                    {topPitches[0].venue.name}
                  </h3>
                  {topPitches[0].rating !== null && (
                    <div className="mt-2 flex items-center gap-1.5 text-[14px]">
                      <StarIcon size={15} className="text-gold" />
                      <b>{topPitches[0].rating?.toFixed(1)}</b>
                      <span className="text-ink-muted">({topPitches[0].reviewCount} reviews)</span>
                    </div>
                  )}
                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-glass-border pt-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-ink-muted">From</div>
                      <div className="text-[22px] font-bold">
                        {formatNaira(topPitches[0].pricePerHourKobo)}
                        <span className="text-[13px] font-medium text-ink-muted">/hr</span>
                      </div>
                    </div>
                    <Link href={`/pitches/${topPitches[0].slug}`} className="btn-t btn-green-t">
                      View venue
                    </Link>
                  </div>
                </div>
              </Reveal>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {topPitches.slice(1, 6).map((p, i) => (
                  <Reveal key={p.id} delay={i * 70}>
                    <PitchCard pitch={p} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
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
            {testimonials.map((t, i) => (
              <div key={t.name} className={i % 3 === 1 ? "sm:-mt-5" : "sm:mt-5"}>
                <Reveal delay={i * 90}>
                  <TestimonialCard {...t} />
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WAITLIST / CTA ================= */}
      <section className="py-24">
        <div className="container-t">
          <Reveal
            as="div"
            className="card-t grain-t relative overflow-hidden p-8 text-center md:p-14"
          >
            <span className="spokes-t" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="font-display text-[clamp(26px,4.5vw,40px)] font-extrabold tracking-[-.02em]">
                We&apos;re just <span className="text-gradient-brand">getting started</span>
              </h2>
              <p className="mt-4 text-[16.5px] leading-relaxed text-ink-soft">
                Tempo is live in Lekki, Ikoyi, Victoria Island, Lagos Island, Surulere, Ikeja
                GRA and Yaba. If your regular spot isn&apos;t here yet, tell us where you
                play and we&apos;ll go and get it verified.
              </p>

              <div className="mt-8">
                <WaitlistForm />
              </div>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/games" className="btn-t btn-green-t glow-brand">
                  Find a game
                </Link>
                <Link href="/host" className="btn-t btn-ghost-t">
                  Host a game
                </Link>
              </div>
            </div>
          </Reveal>
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
