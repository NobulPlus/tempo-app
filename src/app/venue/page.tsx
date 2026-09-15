import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isVenueOwner } from "@/lib/session";
import { listVenues, getVenueStats, listPitches, getBookingsForVenue } from "@/lib/data/repo";
import { formatNaira, formatRelativeDay, formatTime } from "@/lib/format";
import { ACTIVITY_OPTIONS, AMENITY_OPTIONS, venueOptionLabel } from "@/lib/venue-options";
import { BuildingIcon, TrendIcon, ShieldIcon, ClockIcon, PinIcon, WalletIcon, PitchIcon, BallIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Venue dashboard",
  robots: { index: false, follow: false },
};

export default async function VenuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/venue");

  if (!isVenueOwner(user)) {
    return (
      <div className="py-20">
        <div className="container-readable-t">
          <div className="card-t p-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
              <BuildingIcon size={26} />
            </span>
            <h1 className="mt-5 text-[26px] font-extrabold">Venue owner access required</h1>
            <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
              This workspace is for verified venue operators to manage listings,
              spaces, availability and bookings. Your current account is a {user.role.replace("_", " ")} account.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/partner" className="btn-t btn-green-t">
                Apply as a venue owner
              </Link>
              <Link href="/dashboard" className="btn-t btn-ghost-t">
                Back to my games
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allVenues = await listVenues();
  const mine = allVenues.filter((v) => v.ownerId === user.id);

  if (mine.length === 0) {
    return (
      <div className="py-20">
        <div className="container-readable-t">
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
            {!user.identityVerified && (
              <p className="mt-6 text-[13px] text-ink-soft">
                Tip: <Link href="/verify-identity" className="font-semibold text-green">verifying your identity</Link>{" "}
                builds trust with players before your first booking lands.
              </p>
            )}
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
  const single = mine.length === 1;

  return (
    <div className="py-12">
      <div className="container-workspace-t">
        <p className="text-[13px] font-semibold uppercase tracking-[.7px] text-ink-muted">
          Venue dashboard
        </p>
        <h1 className="mt-1.5 text-[clamp(28px,5vw,42px)] font-extrabold tracking-[-.025em]">
          {single ? mine[0].name : `${mine.length} venues`}
        </h1>
        <p className="mt-2 text-[16px] text-ink-soft">managed by {user.fullName}</p>

        {await Promise.all(
          mine.map(async (venue) => {
            const stats = await getVenueStats(venue.id);
            const pitches = allPitches.filter((p) => p.venueId === venue.id);

            const bookings = await getBookingsForVenue(venue.id);
            const upcomingBookings = bookings
              .filter((b) => b.status === "confirmed" && new Date(b.slot.startsAt).getTime() > Date.now())
              .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt))
              .slice(0, 5);

            return (
              <section key={venue.id} className={single ? "mt-8" : "card-t mt-8 p-6 md:p-7"}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {!single && <h2 className="text-[22px] font-bold">{venue.name}</h2>}
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
                    <span className="chip-t capitalize">
                      {venueOptionLabel(ACTIVITY_OPTIONS, venue.activityType ?? "football")}
                    </span>
                  </div>
                  <Link href={`/venue/${venue.id}`} className="btn-t btn-ghost-t !py-2.5 !text-[13.5px]">
                    Manage inventory
                  </Link>
                </div>

                {/* KPIs */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Kpi
                    icon={<TrendIcon size={16} />}
                    label="Utilisation"
                    value={`${stats.utilisation}%`}
                    hint={`${stats.bookedSlots} of ${stats.upcomingSlots} upcoming hours`}
                    accent
                  />
                  <Kpi
                    icon={<WalletIcon size={16} />}
                    label="Projected revenue"
                    value={formatNaira(stats.projectedRevenueKobo)}
                    hint="Confirmed bookings ahead"
                  />
                  <Kpi icon={<PitchIcon size={16} />} label="Pitches" value={String(stats.pitchCount)} />
                  <Kpi icon={<BallIcon size={16} />} label="Games hosted here" value={String(stats.gamesHosted)} />
                </div>

                {Boolean((venue.supportedActivities?.length ?? 0) + venue.amenities.length) && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(venue.supportedActivities ?? [venue.activityType ?? "football"]).slice(0, 5).map((activity) => (
                      <span key={activity} className="chip-t !border-green/30 !bg-green/10 !text-green">
                        {venueOptionLabel(ACTIVITY_OPTIONS, activity)}
                      </span>
                    ))}
                    {venue.amenities.slice(0, 6).map((amenity) => (
                      <span key={amenity} className="chip-t">
                        {venueOptionLabel(AMENITY_OPTIONS, amenity)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Utilisation bar */}
                <div className={`mt-5 p-6 ${single ? "card-t" : "rounded-2xl border border-glass-border bg-bg-primary/40"}`}>
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
                <div className={`mt-5 p-6 ${single ? "card-t" : "rounded-2xl border border-glass-border bg-bg-primary/40"}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-[16px] font-bold">
                      <ClockIcon size={17} />
                      Upcoming bookings
                    </h3>
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/venue/${venue.id}/calendar`}
                        className="text-[13px] font-semibold text-green transition hover:opacity-80"
                      >
                        Calendar →
                      </Link>
                      <Link
                        href={`/venue/${venue.id}/bookings`}
                        className="text-[13px] font-semibold text-green transition hover:opacity-80"
                      >
                        View all →
                      </Link>
                    </div>
                  </div>
                  {upcomingBookings.length === 0 ? (
                    <p className="mt-4 text-[14px] text-ink-soft">No confirmed bookings ahead yet.</p>
                  ) : (
                    <ul className="mt-4 divide-y divide-white/8">
                      {upcomingBookings.map((b) => (
                        <li key={b.id} className="flex items-center justify-between py-3">
                          <div>
                            <div className="text-[14.5px] font-semibold">
                              {formatRelativeDay(b.slot.startsAt)} · {formatTime(b.slot.startsAt)}
                            </div>
                            <div className="text-[12.5px] text-ink-muted">
                              {b.slot.pitch.name} · {b.player?.fullName ?? "Unknown player"} · {b.reference}
                            </div>
                          </div>
                          <div className="text-[14px] font-bold">{formatNaira(b.totalKobo)}</div>
                        </li>
                      ))}
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
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card-t p-5">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <span className={accent ? "text-green" : ""}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1.5 text-[26px] font-extrabold ${accent ? "text-green" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11.5px] text-ink-muted">{hint}</div>}
    </div>
  );
}
