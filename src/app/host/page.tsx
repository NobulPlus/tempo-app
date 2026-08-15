import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listPitches, getSlotsForPitch } from "@/lib/data/repo";
import { HostForm, type HostSlotOption } from "@/components/host/host-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Host a game",
  description:
    "List a game in under two minutes. Tempo handles the roster, the waitlist and the money, so you stop chasing people on WhatsApp.",
};

export default async function HostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host");

  const pitches = await listPitches({ sort: "rated" });

  const slotLists = await Promise.all(
    pitches.map(async (p) => {
      const slots = await getSlotsForPitch(p.id, 10);
      return slots
        .filter((s) => s.status === "open")
        .slice(0, 4)
        .map<HostSlotOption>((s) => ({
          ...s,
          venueName: p.venue.name,
          area: p.venue.area,
          pitchName: p.name,
          size: p.size,
        }));
    }),
  );

  const slots = slotLists
    .flat()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 40);

  return (
    <div className="py-12">
      <div className="container-t">
        <h1 className="text-[clamp(32px,6vw,50px)] font-extrabold tracking-[-.03em]">
          Host a <span className="text-orange">game</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
          Book the pitch, set your number, and let players come to you. Tempo tracks
          who&apos;s in, runs the waitlist when it fills, and refunds everyone
          automatically if the numbers don&apos;t come. No more counting heads in a
          WhatsApp group at 11pm.
        </p>

        <div className="mt-10">
          <HostForm slots={slots} />
        </div>
      </div>
    </div>
  );
}
