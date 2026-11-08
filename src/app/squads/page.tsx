import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listMySquads } from "@/lib/data/repo";
import { JoinByCodeBox } from "@/components/squads/join-by-code-box";
import { GroupIcon, PinIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your squads",
  description: "Recurring football groups with a weekly game, a private roster, and a shared schedule.",
};

export default async function SquadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/squads");

  const squads = await listMySquads(user.id);

  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[.14em] text-orange">Private groups</p>
            <h1 className="mt-2 text-[clamp(30px,5vw,48px)] font-extrabold tracking-[-.03em]">
              Your <span className="text-orange">squads</span>
            </h1>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-soft">
              A squad is a private group with its own weekly game, roster and schedule — invite your
              regulars and Tempo handles the rest.
            </p>
          </div>
          <Link href="/squads/new" className="btn-t btn-green-t !py-3 !text-[14px]">
            Create a squad
          </Link>
        </div>

        <div className="mt-6 max-w-sm">
          <JoinByCodeBox />
        </div>

        <div className="mt-8 space-y-3">
          {squads.length === 0 ? (
            <div className="card-t p-8 text-center">
              <GroupIcon size={28} className="mx-auto text-ink-muted" />
              <p className="mt-3 text-[14.5px] text-ink-soft">
                You&apos;re not in a squad yet. Create one, or join with an invite link from a friend.
              </p>
            </div>
          ) : (
            squads.map((squad) => (
              <Link
                key={squad.id}
                href={`/squads/${squad.slug}`}
                className="card-t card-t-hover flex items-center justify-between gap-3 p-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[16px] font-bold">{squad.name}</span>
                    {squad.role === "owner" && (
                      <span className="chip-t !border-green/30 !bg-green/10 !text-green">Owner</span>
                    )}
                  </div>
                  {squad.area && (
                    <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                      <PinIcon size={13} />
                      {squad.area}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
