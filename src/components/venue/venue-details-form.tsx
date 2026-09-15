"use client";

import { useActionState } from "react";
import { updateVenueAction, type ActionState } from "@/app/actions";
import type { Venue } from "@/lib/types";
import { useActionToast } from "@/components/toast/use-action-toast";
import { Field, TextAreaField } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { LagosAreaField } from "@/components/venue/lagos-area-field";
import { VenueAddressLocationField } from "@/components/venue/venue-address-location-field";
import { VenueActivityFields, VenueAmenityFields } from "@/components/venue/venue-feature-fields";
import { VenuePhotoField } from "@/components/venue/venue-photo-field";

const initial: ActionState = {};
const SIDE_OPTIONS = [
  { value: "island", label: "Island" },
  { value: "mainland", label: "Mainland" },
];

export function VenueDetailsForm({ venue }: { venue: Venue }) {
  const [state, formAction, pending] = useActionState(updateVenueAction, initial);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={venue.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue name" name="name" defaultValue={venue.name} />
        <LagosAreaField defaultValue={venue.area} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Lagos side" name="side" defaultValue={venue.side} options={SIDE_OPTIONS} />
        <Field label="Contact phone" name="phone" defaultValue={venue.phone ?? ""} />
      </div>

      <VenueActivityFields primary={venue.activityType} supported={venue.supportedActivities} />
      <VenueAmenityFields selected={venue.amenities} />

      <VenuePhotoField label="Add venue photos" hint="New photos are added before older ones, up to 8 total." multiple />

      <VenueAddressLocationField defaultAddress={venue.address} defaultLat={venue.lat} defaultLng={venue.lng} />

      <TextAreaField
        label="Description"
        id="description"
        name="description"
        rows={3}
        maxLength={600}
        defaultValue={venue.description}
      />

      {venue.photos.length > 0 && (
        <div>
          <div className="mb-2 text-[13px] font-semibold text-ink-soft">Current photos</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {venue.photos.slice(0, 6).map((photo) => (
              <div
                key={photo}
                className="aspect-[4/3] rounded-xl border border-glass-border bg-cover bg-center"
                style={{ backgroundImage: `url(${photo})` }}
              />
            ))}
          </div>
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-t btn-green-t">
        {pending ? "Saving…" : "Save venue details"}
      </button>
    </form>
  );
}
