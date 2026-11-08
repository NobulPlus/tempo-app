import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  getSquadBySlug,
  getSquadMembers,
  getSquadRecurringTemplates,
  getSquadGames,
  listPitches,
} from "@/lib/data/repo";
import { formatTime } from "@/lib/format";
import { GameCard } from "@/components/match/game-card";
import { SquadInviteButton } from "@/components/squads/squad-invite-button";
import { SquadTemplateForm } from "@/components/squads/squad-template-form";
import { ToggleTemplateButton } from "@/components/squads/toggle-template-button";
import { LeaveSquadButton, RemoveSquadMemberButton } from "@/components/squads/squad-member-actions";
import { PinIcon, ClockIcon, CalendarIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const squad = await getSquadBySlug(slug);
  return { title: squad ? squad.name : "Squad" };
}

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SquadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/squads/${slug}`);

  const squad = await getSquadBySlug(slug);
  if (!squad) notFound();

  const [members, templates, games, pitches] = await Promise.all([
    getSquadMembers(squad.id),
    getSquadRecurringTemplates(squad.id),
    getSquadGames(squad.id),
    listPitches(),
  ]);

  const isOwner = members.some((m) => m.userId === user.id && m.role === "owner");
  const now = new Date().getTime();
  const upcoming = games.filter((g) => new Date(g.endsAt).getTime() > now && g.status !== "cancelled");
  const past = games.filter((g) => !upcoming.includes(g));
  const pitchOptions = pitches.map((p) => ({ id: p.id, label: `${p.venue.name} — ${p.name} (${p.venue.area})` }));

  return (
    <div className="py-12">
      <div className="container-t max-w-5xl">
        <nav className="mb-6 text-[13.5px] text-ink-muted">
          <Link href="/squads" className="transition hover:text-green">
            Squads
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink-soft">{squad.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[clamp(28px,4.5vw,42px)] font-extrabold tracking-[-.03em]">{squad.name}</h1>
            {squad.area && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[13.5px] text-ink-soft">
                <PinIcon size={14} />
                {squad.area}
              </div>
            )}
            {squad.description && <p className="mt-2 max-w-xl text-[14.5px] text-ink-soft">{squad.description}</p>}
          </div>
          <LeaveSquadButton squadId={squad.id} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section>
              <h2 className="text-[16px] font-bold">This week</h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-white/10 bg-white/4 p-6 text-center text-[13.5px] text-ink-soft">
                  No upcoming game yet{isOwner && templates.length === 0 ? " — set a weekly schedule below." : "."}
                </p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {upcoming.map((game) => (
                    <GameCard key={game.id} game={game} />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="text-[16px] font-bold">Past games</h2>
                <div className="mt-3 space-y-2">
                  {past.slice(0, 8).map((game) => (
                    <Link
                      key={game.id}
                      href={`/games/${game.slug}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 p-3 text-[13.5px] transition hover:border-green/35"
                    >
                      <span>{game.title}</span>
                      <span className="text-ink-muted">{formatTime(game.startsAt)}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-bold">Weekly schedule</h2>
              </div>
              {templates.length === 0 && !isOwner && (
                <p className="mt-3 text-[13.5px] text-ink-soft">No weekly schedule set yet.</p>
              )}
              {templates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 p-4">
                      <div className="flex items-center gap-2 text-[13.5px]">
                        <CalendarIcon size={14} className="text-green" />
                        {DAY_LABEL[t.dayOfWeek]}
                        <ClockIcon size={14} className="ml-2 text-green" />
                        {String(Math.floor(t.startMinute / 60)).padStart(2, "0")}:{String(t.startMinute % 60).padStart(2, "0")}
                        {!t.enabled && <span className="chip-t ml-2 !border-orange/30 !bg-orange/10 !text-orange">Paused</span>}
                      </div>
                      {isOwner && <ToggleTemplateButton templateId={t.id} squadSlug={squad.slug} enabled={t.enabled} />}
                    </div>
                  ))}
                </div>
              )}
              {isOwner && (
                <div className="mt-4 card-t p-5">
                  <h3 className="mb-3 text-[14px] font-bold">
                    {templates.length > 0 ? "Add another weekly slot" : "Set your weekly game"}
                  </h3>
                  <SquadTemplateForm squadId={squad.id} squadSlug={squad.slug} template={null} pitchOptions={pitchOptions} />
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <div className="card-t p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-bold">Members ({members.length})</h2>
              </div>
              <div className="mt-3 space-y-2">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-2">
                    <Link href={`/players/${m.player?.handle}`} className="flex items-center gap-2 text-[13.5px] hover:text-green">
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-green/40 bg-green/10 text-[11px] font-bold">
                        {m.player?.initials}
                      </span>
                      {m.player?.fullName}
                      {m.role === "owner" && <span className="chip-t !border-green/30 !bg-green/10 !text-green">Owner</span>}
                    </Link>
                    {isOwner && m.userId !== user.id && (
                      <RemoveSquadMemberButton squadId={squad.id} squadSlug={squad.slug} memberId={m.userId} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isOwner && (
              <div className="card-t p-5">
                <h2 className="text-[14px] font-bold">Invite</h2>
                <p className="mt-1 text-[12.5px] text-ink-soft">Share this link with your regulars.</p>
                <div className="mt-3">
                  <SquadInviteButton squadId={squad.id} />
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
