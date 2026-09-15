"use client";

import { useActionState, useRef, useEffect } from "react";
import { createPitchAction, type ActionState } from "@/app/actions";
import { useActionToast } from "@/components/toast/use-action-toast";
import { Field, TextAreaField } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { VenuePhotoField } from "@/components/venue/venue-photo-field";
import {
  ResourceActivityFields,
  ResourceFeatureFields,
  ResourceTypeField,
} from "@/components/venue/resource-feature-fields";

const initial: ActionState = {};

const SIZES = ["5-a-side", "7-a-side", "11-a-side"] as const;
const SURFACES = ["astro", "grass", "indoor", "concrete"] as const;

export function AddPitchForm({ venueId }: { venueId: string }) {
  const [state, formAction, pending] = useActionState(createPitchAction, initial);
  useActionToast(state);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="card-t space-y-4 p-6">
      <input type="hidden" name="venueId" value={venueId} />
      <div>
        <h3 className="text-[16px] font-bold">Add bookable space</h3>
        <p className="mt-1 text-[13px] text-ink-soft">
          Add each pitch, court, studio or field as its own resource so players know exactly what they are booking.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="pitch-name" label="Space name" name="name" required placeholder="e.g. Main Pitch, Court 1" />
        <ResourceTypeField />
      </div>

      <ResourceActivityFields />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Football size"
          name="size"
          defaultValue={SIZES[0]}
          options={SIZES.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Surface"
          name="surface"
          defaultValue={SURFACES[0]}
          options={SURFACES.map((s) => ({ value: s, label: s }))}
        />
        <Field
          id="pitch-price"
          label="Price per hour (₦)"
          name="pricePerHourNaira"
          type="number"
          min={500}
          step={500}
          required
          placeholder="30000"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="capacity"
          label="Max capacity"
          name="capacity"
          type="number"
          min={1}
          max={500}
          placeholder="e.g. 22"
        />
        <Field
          id="recommended-players"
          label="Recommended players"
          name="recommendedPlayers"
          type="number"
          min={1}
          max={100}
          placeholder="e.g. 10"
        />
      </div>

      <ResourceFeatureFields />

      <Field
        id="peak-multiplier"
        label="Peak multiplier (weekday 5-9pm)"
        name="peakMultiplier"
        type="number"
        min={1}
        max={3}
        step={0.1}
        defaultValue={1.3}
        className="max-w-[220px]"
      />

      <VenuePhotoField
        name="resourcePhotos"
        label="Space photos"
        hint="Upload up to 8 photos of this exact space. The first image becomes its cover."
        multiple
      />

      <TextAreaField
        label="Space description (optional)"
        name="description"
        rows={3}
        maxLength={600}
        placeholder="Describe surface quality, markings, lighting, restrictions or best use cases."
      />

      <button type="submit" disabled={pending} className="btn-t btn-green-t !py-3 !text-[14px]">
        {pending ? "Adding..." : "Add bookable space"}
      </button>
    </form>
  );
}
