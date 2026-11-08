import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getSquadPreviewByCode } from "@/lib/data/repo";
import { JoinSquadForm } from "@/components/squads/join-squad-form";
import { GroupIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Join a squad" };

export default async function JoinSquadPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [user, preview] = await Promise.all([getCurrentUser(), getSquadPreviewByCode(code)]);

  return (
    <div className="py-16">
      <div className="container-t max-w-md">
        <div className="card-t p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green/10 text-green">
            <GroupIcon size={26} />
          </span>

          {!preview ? (
            <>
              <h1 className="mt-4 text-[22px] font-extrabold">Invite not found</h1>
              <p className="mt-2 text-[14px] text-ink-soft">
                This invite link is invalid, expired, or has been revoked. Ask the squad owner for a new one.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-[13px] font-semibold uppercase tracking-[.1em] text-ink-muted">
                You&apos;re invited to join
              </p>
              <h1 className="mt-1 text-[24px] font-extrabold">{preview.name}</h1>
              <p className="mt-1 text-[13.5px] text-ink-soft">
                {preview.area ? `${preview.area} · ` : ""}
                {preview.memberCount} member{preview.memberCount === 1 ? "" : "s"}
              </p>

              <div className="mt-6">
                {!user ? (
                  <Link href={`/login?next=/squads/join/${code}`} className="btn-t btn-green-t w-full">
                    Log in to join
                  </Link>
                ) : (
                  <JoinSquadForm code={code} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
