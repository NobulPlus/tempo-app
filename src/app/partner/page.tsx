import type { Metadata } from "next";
import { BuildingIcon, TrendIcon, ShieldIcon, ClockIcon } from "@/components/icons";
import { PartnerForm } from "@/components/partner-form";

export const metadata: Metadata = {
  title: "Partner with Us",
  description:
    "List your pitch on Tempo. We visit and verify every venue, then fill your empty hours with players who've already paid.",
};

const REASONS = [
  {
    Icon: TrendIcon,
    h: "Fill the hours nobody's booking",
    p: "Weekday mornings, off-peak afternoons — the hours your pitch sits empty are exactly what Tempo's players are looking for.",
  },
  {
    Icon: ShieldIcon,
    h: "Paid before they show up",
    p: "Bookings are confirmed and held before anyone turns up. No chasing no-shows for cash on the day.",
  },
  {
    Icon: ClockIcon,
    h: "You control the calendar",
    p: "Set your own hours, prices and peak-time rates. Block out slots whenever you need to.",
  },
];

export default function PartnerPage() {
  return (
    <div className="py-12">
      <div className="container-t max-w-3xl">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
          <BuildingIcon size={26} />
        </span>

        <h1 className="mt-5 text-[clamp(28px,5.5vw,44px)] font-extrabold tracking-[-.025em]">
          List your venue on Tempo
        </h1>
        <p className="mt-3 max-w-xl text-[16.5px] leading-relaxed text-ink-soft">
          If you operate a pitch in Lagos, your empty hours are worth money you&apos;re
          currently not collecting. We visit and verify every venue before it goes
          live, and Tempo&apos;s players fill the rest.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {REASONS.map(({ Icon, h, p }) => (
            <div key={h} className="card-t p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-glass text-green">
                <Icon size={19} />
              </span>
              <h3 className="mt-3.5 text-[15px] font-bold leading-snug">{h}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{p}</p>
            </div>
          ))}
        </div>

        <div className="card-t mt-8 p-8 text-center">
          <h2 className="text-[19px] font-bold">Tell us about your venue</h2>
          <p className="mt-1.5 text-[14.5px] text-ink-soft">
            Leave your details and we&apos;ll be in touch to arrange a visit.
          </p>
          <div className="mt-6">
            <PartnerForm />
          </div>
        </div>
      </div>
    </div>
  );
}
