import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listVenues, getVenueStats, listPitches, getSlotsForPitch } from "@/lib/data/repo";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { BuildingIcon, TrendIcon, ShieldIcon, ClockIcon, PinIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Venue dashboard",
  robots: { index: false, follow: false },
};

export default async function VenuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/venue");

  const allVenues = await listVenues();
  const mine = allVenues.filter((v) => v.ownerId === user.id);

  if (mine.length === 0) {
    return (
      <div className="py-20">
        <div className="container-t max-w-2xl">
          <div className="card-t p-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
              <BuildingIcon size={26} />
            </span>
            <h1 className="mt-5 text-[26px] font-extrabold">You don&apos;t run a venue yet</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              If you operate a pitch in Lagos, listing it on Tempo means your empty
              hours get filled by players who&apos;ve already paid. We visit and verify
              every venue before it goes live.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/venue/new" className="btn-t btn-green-t">
                Add your first venue
              </Link>
              <Link href="/partner" className="btn-t btn-ghost-t">
                Have someone from Tempo reach out instead
              </Link>
            </div>
            <p className="mt-6 text-[12.5px] text-ink-muted">
              In demo mode, sign in as Folake Johnson to see the venue dashboard with
              real data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const allPitches = await listPitches();

  return (
    <div className="py-12">
      <div className="container-t">
        <h1 className="text-[clamp(28px,5vw,42px)] font-extrabold tracking-[-.025em]">
          Venue dashboard
        </h1>
        <p className="mt-2 text-[16px] text-ink-soft">
          {mine.length === 1 ? mine[0].name : `${mine.length} venues`} · managed by{" "}
          {user.fullName}
        </p>

        {await Promise.all(
          mine.map(async (venue) => {
            const stats = await getVenueStats(venue.id);
            const pitches = allPitches.filter((p) => p.venueId === venue.id);

            const upcoming = (
              await Promise.all(pitches.map((p) => getSlotsForPitch(p.id, 5)))
            )
              .flat()
              .filter((s) => s.status === "booked")
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .slice(0, 8);

            return (
              <section key={venue.id} className="mt-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-[22px] font-bold">{venue.name}</h2>
                    {venue.verified ? (
                      <span className="chip-t !border-green/35 !bg-green/12 !text-green">
                        <ShieldIcon size={12} />
                        Verified
                      </span>
                    ) : (
                      <span className="chip-t !border-gold/35 !bg-gold/12 !text-gold">
                        Awaiting verification
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-[13.5px] text-ink-muted">
                      <PinIcon size={13} />
                      {venue.area}
                    </span>
                  </div>
                  <Link href={`/venue/${venue.id}`} className="btn-t btn-ghost-t !py-2.5 !text-[13.5px]">
                    Manage inventory
                  </Link>
                </div>

                {/* KPIs */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Kpi
                    label="Utilisation"
                    value={`${stats.utilisation}%`}
                    hint={`${stats.bookedSlots} of ${stats.upcomingSlots} upcoming hours`}
                    accent
                  />
                  <Kpi
                    label="Projected revenue"
                    value={formatNaira(stats.projectedRevenueKobo)}
                    hint="Confirmed bookings ahead"
                  />
                  <Kpi label="Pitches" value={String(stats.pitchCount)} />
                  <Kpi label="Games hosted here" value={String(stats.gamesHosted)} />
                </div>

                {/* Utilisation bar */}
                <div className="card-t mt-5 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-[16px] font-bold">
                      <TrendIcon size={17} className="text-green" />
                      Where the empty hours are
                    </h3>
                    <span className="text-[12.5px] text-ink-muted">Next 7 days</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {pitches.map((p) => {
                      const pct = Math.min(
                        100,
                        Math.round(
                          (stats.bookedSlots / Math.max(1, stats.upcomingSlots)) * 100,
                        ),
                      );
                      return (
                        <div key={p.id}>
                          <div className="mb-1.5 flex justify-between text-[13.5px]">
                            <span>
                              {p.name} · {p.size}
                            </span>
                            <span className="text-ink-muted">
                              {formatNaira(p.pricePerHourKobo)}/hr
                            </span>
                          </div>
                          <div className="fill-track">
                            <div
                              className="fill-bar"
                              data-heat={pct > 75 ? "hot" : pct > 45 ? "warm" : undefined}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
                    Weekday mornings are your softest spot. Most venues fill them by
                    listing a discounted open game — players will take 7am if the
                    price moves.
                  </p>
                </div>

                {/* Upcoming bookings */}
                <div className="card-t mt-5 p-6">
                  <h3 className="flex items-center gap-2 text-[16px] font-bold">
                    <ClockIcon size={17} />
                    Upcoming bookings
                  </h3>
                  {upcoming.length === 0 ? (
                    <p className="mt-4 text-[14px] text-ink-soft">
                      Nothing booked in the next 5 days.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-white/8">
                      {upcoming.map((s) => {
                        const pitch = pitches.find((p) => p.id === s.pitchId);
                        return (
                          <li key={s.id} className="flex items-center justify-between py-3">
                            <div>
                              <div className="text-[14.5px] font-semibold">
                                {formatRelativeDay(s.startsAt)} · {formatTime(s.startsAt)}
                              </div>
                              <div className="text-[12.5px] text-ink-muted">
                                {pitch?.name} · {pitch?.size}
                              </div>
                            </div>
                            <div className="text-[14px] font-bold">
                              {formatNaira(s.priceKobo)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            );
          }),
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card-t p-5">
      <div className="text-[12px] text-ink-muted">{label}</div>
      <div className={`mt-1 text-[26px] font-extrabold ${accent ? "text-green" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</div>}
    </div>
  );
}
