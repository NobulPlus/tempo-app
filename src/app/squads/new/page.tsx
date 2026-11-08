import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LAGOS_AREA_OPTIONS } from "@/lib/lagos";
import { CreateSquadForm } from "@/components/squads/create-squad-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create a squad",
};

export default async function NewSquadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/squads/new");

  return (
    <div className="py-12">
      <div className="container-t max-w-lg">
        <p className="text-[12px] font-bold uppercase tracking-[.14em] text-orange">Private groups</p>
        <h1 className="mt-2 text-[clamp(28px,5vw,40px)] font-extrabold tracking-[-.03em]">
          Create a <span className="text-orange">squad</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          You&apos;ll be the owner — you can invite your regulars, set a weekly schedule, and manage the
          roster.
        </p>

        <div className="mt-6 card-t p-6">
          <CreateSquadForm areaOptions={LAGOS_AREA_OPTIONS} />
        </div>
      </div>
    </div>
  );
}
