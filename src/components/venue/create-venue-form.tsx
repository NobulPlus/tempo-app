"use client";

import { useActionState } from "react";
import { createVenueAction, type ActionState } from "@/app/actions";
import { BuildingIcon } from "@/components/icons";
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

export function CreateVenueForm() {
  const [state, formAction, pending] = useActionState(createVenueAction, initial);
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-4">
      <div className="field-t">
        <input id="name" name="name" required placeholder=" " />
        <span className="field-icon">
          <BuildingIcon size={18} />
        </span>
        <label htmlFor="name" className="floating">
          Venue name
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LagosAreaField floating />
        <Select label="Lagos side" name="side" defaultValue="island" options={SIDE_OPTIONS} />
      </div>

      <VenueActivityFields />

      <Field label="Contact phone (optional)" id="phone" name="phone" type="tel" placeholder="0801 234 5678" />

      <VenueAddressLocationField />

      <VenuePhotoField
        label="Venue photos"
        hint="Upload up to 8 clear photos. The first photo becomes the cover."
        multiple
      />

      <TextAreaField
        label="Description (optional)"
        id="description"
        name="description"
        rows={3}
        maxLength={600}
        placeholder="What makes this venue worth booking?"
      />

      <VenueAmenityFields />

      <button type="submit" disabled={pending} className="btn-t btn-green-t w-full">
        {pending ? "Creating…" : "Create venue"}
      </button>

      <p className="text-center text-[12px] text-ink-muted">
        New venues start unverified — someone from Tempo visits in person before
        it&apos;s bookable. You can add pitches and availability right away.
      </p>
    </form>
  );
}
