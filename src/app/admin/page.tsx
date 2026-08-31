import Link from "next/link";
import { listGames, listProfiles, listVenues, listWaitlist } from "@/lib/data/repo";
import { getMatchState } from "@/lib/match";
import { formatRelativeDay, formatTime } from "@/lib/format";
import {
  BallIcon,
  BuildingIcon,
  ClockIcon,
  PinIcon,
  ShieldIcon,
  TrendIcon,
  UsersIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";

export default async function AdminOverviewPage() {
  const [venues, profiles, leads, games] = await Promise.all([
    listVenues(),
    listProfiles(),
    listWaitlist(),
    listGames(),
  ]);

  const unverified = venues.filter((v) => !v.verified);
  const suspended = profiles.filter((p) => p.suspended);
  const hosts = profiles.filter((p) => p.role === "host");
  const venueOwners = profiles.filter((p) => p.role === "venue_owner");
  const partnerLeads = leads.filter((l) => l.role === "venue_owner");
  const playerLeads = leads.filter((l) => l.role !== "venue_owner");
  const urgentGames = games
    .map((game) => ({ game, state: getMatchState(game) }))
    .filter(({ state }) => !state.hasEnded && state.spotsLeft > 0)
    .sort((a, b) => a.state.msToKickoff - b.state.msToKickoff)
    .slice(0, 4);
  const areaDemand = Array.from(
    leads.reduce((map, lead) => {
      const area = lead.area?.trim() || "No area";
      map.set(area, (map.get(area) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const islandVenues = venues.filter((v) => v.side === "island").length;
  const mainlandVenues = venues.filter((v) => v.side === "mainland").length;
  const peopleToReview = profiles
    .filter((p) => p.suspended || p.punctualityScore < 80 || (p.peerRating ?? 5) < 4)
    .sort(
      (a, b) =>
        Number(b.suspended) - Number(a.suspended) ||
        a.punctualityScore - b.punctualityScore,
    )
    .slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone="green" icon={<ShieldIcon size={13} />}>
            Admin
          </Badge>
          <h1 className="mt-3 font-display text-[clamp(30px,5vw,46px)] font-extrabold leading-tight">
            Tempo control room
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
            Keep venue supply verified, protect host trust and spot the parts of Lagos asking
            for more games.
          </p>
        </div>
        <Link href="/admin/venues" className="btn-t btn-green-t !px-5 !py-3 !text-[14px]">
          Review venues
        </Link>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pending venues"
          value={unverified.length}
          tone={unverified.length ? "text-gold" : "text-green"}
        />
        <Metric label="Open leads" value={leads.length} sub={`${partnerLeads.length} partner`} />
        <Metric label="Active hosts" value={hosts.length} sub={`${venueOwners.length} venue owner`} />
        <Metric
          label="Moderation flags"
          value={suspended.length}
          tone={suspended.length ? "text-orange" : "text-green"}
        />
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="card-t overflow-hidden">
          <PanelHeader icon={<BuildingIcon size={14} />} kicker="Supply pipeline" title="Venue verification" />
          <div className="divide-y divide-glass-border">
            {unverified.slice(0, 4).map((venue) => (
              <Link
                key={venue.id}
                href="/admin/venues"
                className="grid gap-3 p-4 transition hover:bg-green/6 sm:grid-cols-[1fr_auto]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold">{venue.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <PinIcon size={12} />
                      {venue.area}
                    </span>
                    <span className="capitalize">{venue.side}</span>
                    <span>{venue.amenities.length} amenities</span>
                  </span>
                </span>
                <span className="text-[12.5px] font-semibold text-gold">Needs review</span>
              </Link>
            ))}
            {unverified.length === 0 && (
              <p className="p-5 text-[14px] text-ink-soft">All venues are verified right now.</p>
            )}
          </div>
        </section>

        <section className="card-t overflow-hidden">
          <PanelHeader icon={<PinIcon size={14} />} kicker="Lagos coverage" title="Demand by area" />
          <div className="p-5">
            <div className="mb-5 grid grid-cols-2 gap-3">
              <Mini label="Island venues" value={islandVenues} />
              <Mini label="Mainland venues" value={mainlandVenues} />
            </div>
            <div className="space-y-3">
              {areaDemand.map(([area, count]) => (
                <div key={area}>
                  <div className="mb-1 flex justify-between text-[12.5px]">
                    <span className="font-semibold">{area}</span>
                    <span className="text-ink-muted">
                      {count} lead{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-glass">
                    <div
                      className="h-2 rounded-full bg-green"
                      style={{
                        width: `${Math.max(18, (count / Math.max(1, areaDemand[0]?.[1] ?? count)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {areaDemand.length === 0 && (
                <p className="text-[14px] text-ink-soft">No waitlist demand to rank yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="card-t overflow-hidden">
          <PanelHeader icon={<BallIcon size={14} />} kicker="Matchday health" title="Games needing players" />
          <div className="divide-y divide-glass-border">
            {urgentGames.map(({ game, state }) => (
              <Link
                key={game.id}
                href={`/games/${game.slug}`}
                className="grid gap-3 p-4 transition hover:bg-green/6 sm:grid-cols-[1fr_auto]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold">{game.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                    <span>{game.pitch.venue.area}</span>
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon size={12} />
                      {formatRelativeDay(game.startsAt)} {formatTime(game.startsAt)}
                    </span>
                  </span>
                </span>
                <span className="text-[12.5px] font-semibold text-orange">
                  {state.spotsLeft} spot{state.spotsLeft === 1 ? "" : "s"} left
                </span>
              </Link>
            ))}
            {urgentGames.length === 0 && (
              <p className="p-5 text-[14px] text-ink-soft">No upcoming games need attention.</p>
            )}
          </div>
        </section>

        <section className="card-t overflow-hidden">
          <PanelHeader icon={<UsersIcon size={14} />} kicker="Trust signals" title="People to review" />
          <div className="divide-y divide-glass-border">
            {peopleToReview.map((profile) => (
              <Link
                key={profile.id}
                href="/admin/users"
                className="flex items-center gap-3 p-4 transition hover:bg-green/6"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-green/35 bg-green/10 text-[12px] font-bold">
                  {profile.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {profile.fullName}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    @{profile.handle} - punctuality {profile.punctualityScore}
                  </span>
                </span>
                <span className={profile.suspended ? "text-orange" : "text-gold"}>
                  {profile.suspended ? "Suspended" : "Watch"}
                </span>
              </Link>
            ))}
            {peopleToReview.length === 0 && (
              <p className="p-5 text-[14px] text-ink-soft">
                No obvious trust risks in the player base.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Action
          href="/admin/leads"
          title="Follow up partner leads"
          meta={`${partnerLeads.length} venue-owner leads`}
        />
        <Action
          href="/admin/leads"
          title="Plan next area launch"
          meta={`${playerLeads.length} player waitlist entries`}
        />
      </div>
    </div>
  );
}

function PanelHeader({
  icon,
  kicker,
  title,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <div className="border-b border-glass-border p-5">
      <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.9px] text-ink-muted">
        {icon}
        {kicker}
      </div>
      <h2 className="mt-2 text-[20px] font-bold">{title}</h2>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone = "text-ink",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="card-t p-5">
      <div className="text-[12px] font-semibold uppercase tracking-[.7px] text-ink-muted">
        {label}
      </div>
      <div className={`mt-1 text-[32px] font-extrabold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-muted">{sub}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="text-[11.5px] text-ink-muted">{label}</div>
      <div className="mt-0.5 text-[20px] font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function Action({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <Link
      href={href}
      className="card-t flex items-center justify-between gap-4 p-5 transition hover:border-green/35"
    >
      <span>
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="mt-0.5 block text-[12.5px] text-ink-muted">{meta}</span>
      </span>
      <TrendIcon size={18} className="shrink-0 text-green" />
    </Link>
  );
}
