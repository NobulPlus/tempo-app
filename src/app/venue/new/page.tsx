import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CreateVenueForm } from "@/components/venue/create-venue-form";
import { BuildingIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add a venue",
  robots: { index: false, follow: false },
};

export default async function NewVenuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/venue/new");

  return (
    <div className="py-14">
      <div className="container-t max-w-lg">
        <div className="card-t relative overflow-hidden p-8">
          <span className="spokes-t" />
          <div className="relative text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green/12 text-green">
              <BuildingIcon size={26} />
            </span>
            <h1 className="mt-4 text-[24px] font-extrabold">Add your venue</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-soft">
              A few details to get it listed — you can add pitches next.
            </p>
          </div>

          <div className="relative mt-7">
            <CreateVenueForm />
          </div>
        </div>
      </div>
    </div>
  );
}
