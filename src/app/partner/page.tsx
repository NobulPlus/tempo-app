import type { Metadata } from "next";
import { BuildingIcon, TrendIcon, ShieldIcon, ClockIcon } from "@/components/icons";
import { PartnerForm } from "@/components/partner-form";
import { VenueOwnerApplicationForm } from "@/components/venue-owner-application-form";
import { getVenueOwnerApplication } from "@/lib/data/repo";
import { getCurrentUser, isVenueOwner } from "@/lib/session";

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

export default async function PartnerPage() {
  const user = await getCurrentUser();
  const application = user ? await getVenueOwnerApplication(user.id) : null;

  return (
    <div className="py-12">
      <div className="container-workspace-t">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)] lg:items-start">
          <div>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
              <BuildingIcon size={26} />
            </span>

            <h1 className="mt-5 text-[clamp(28px,5.5vw,44px)] font-extrabold tracking-[-.025em]">
              List your venue on Tempo
            </h1>
            <p className="mt-3 max-w-2xl text-[16.5px] leading-relaxed text-ink-soft">
              If you operate a pitch in Lagos, your empty hours are worth money you&apos;re
              currently not collecting. We visit and verify every venue before it goes
              live, and Tempo&apos;s players fill the rest.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
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
          </div>

          <div className="card-t p-7 text-center lg:sticky lg:top-24">
            <h2 className="text-[19px] font-bold">
              {user ? "Apply for venue owner access" : "Tell us about your venue"}
            </h2>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              {user
                ? "Submit the venue you operate. Approval unlocks the venue dashboard."
                : "Leave your details and we&apos;ll be in touch to arrange a visit."}
            </p>
            <div className="mt-6">
              {user ? (
                <VenueOwnerApplicationForm application={application} hasAccess={isVenueOwner(user)} />
              ) : (
                <PartnerForm />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
