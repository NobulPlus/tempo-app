"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePitchAction, type ActionState } from "@/app/actions";
import { formatNaira } from "@/lib/format";
import { ClockIcon } from "@/components/icons";
import { Field, TextAreaField } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { VenuePhotoField } from "@/components/venue/venue-photo-field";
import {
  ResourceActivityFields,
  ResourceFeatureFields,
  ResourceTypeField,
} from "@/components/venue/resource-feature-fields";
import type { Pitch } from "@/lib/types";
import { useActionToast } from "@/components/toast/use-action-toast";

const initial: ActionState = {};
const SIZES = ["5-a-side", "7-a-side", "11-a-side"] as const;
const SURFACES = ["astro", "grass", "indoor", "concrete"] as const;

export function PitchManageCard({ venueId, pitch }: { venueId: string; pitch: Pitch }) {
  const [state, formAction, pending] = useActionState(updatePitchAction, initial);
  const [toggleState, toggleAction, togglePending] = useActionState(updatePitchAction, initial);
  useActionToast(state);
  useActionToast(toggleState);

  return (
    <div className="card-t p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-[15px] font-bold">{pitch.name}</h4>
            <span className="chip-t capitalize">{(pitch.resourceType ?? "pitch").replaceAll("-", " ")}</span>
            <span className="chip-t">{pitch.size}</span>
            {!pitch.active && (
              <span className="chip-t !border-orange/35 !bg-orange/12 !text-orange">
                Unpublished
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted">
            {pitch.surface} · {pitch.activityType ?? "football"} · {formatNaira(pitch.pricePerHourKobo)}/hr
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/venue/${venueId}/pitches/${pitch.id}`}
            className="btn-t btn-ghost-t !px-3.5 !py-2 !text-[13px]"
          >
            <ClockIcon size={14} />
            Availability
          </Link>
          <form action={toggleAction}>
            <input type="hidden" name="pitchId" value={pitch.id} />
            <input type="hidden" name="active" value={pitch.active ? "false" : "true"} />
            <button
              type="submit"
              disabled={togglePending}
              className={`btn-t !px-3.5 !py-2 !text-[13px] ${pitch.active ? "btn-ghost-t" : "btn-green-t"}`}
            >
              {togglePending ? "Working…" : pitch.active ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      <form action={formAction} className="mt-5 space-y-4 border-t border-glass-border pt-5">
        <input type="hidden" name="pitchId" value={pitch.id} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" name="name" defaultValue={pitch.name} />
          <ResourceTypeField defaultValue={pitch.resourceType ?? "pitch"} />
          <Select
            label="Football size"
            name="size"
            defaultValue={pitch.size}
            options={SIZES.map((s) => ({ value: s, label: s }))}
          />
          <Select
            label="Surface"
            name="surface"
            defaultValue={pitch.surface}
            options={SURFACES.map((s) => ({ value: s, label: s }))}
          />
        </div>

        <ResourceActivityFields
          primary={pitch.activityType}
          supported={pitch.supportedActivities}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Price/hr (₦)"
            name="pricePerHourNaira"
            type="number"
            min={500}
            step={500}
            defaultValue={pitch.pricePerHourKobo / 100}
          />
          <Field
            label="Peak x"
            name="peakMultiplier"
            type="number"
            min={1}
            max={3}
            step={0.1}
            defaultValue={pitch.peakMultiplier}
          />
          <Field
            label="Max capacity"
            name="capacity"
            type="number"
            min={1}
            max={500}
            defaultValue={pitch.capacity ?? ""}
          />
          <Field
            label="Recommended players"
            name="recommendedPlayers"
            type="number"
            min={1}
            max={100}
            defaultValue={pitch.recommendedPlayers ?? ""}
          />
        </div>

        <ResourceFeatureFields selected={pitch.amenities ?? []} />

        <VenuePhotoField
          name="resourcePhotos"
          label="Add space photos"
          hint="New photos appear first, up to 8 total."
          multiple
        />

        {(pitch.photos?.length ?? 0) > 0 && (
          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink-soft">Current photos</div>
            <div className="grid gap-3 sm:grid-cols-4">
              {(pitch.photos ?? []).slice(0, 8).map((photo) => (
                <div
                  key={photo}
                  className="aspect-[4/3] rounded-xl border border-glass-border bg-cover bg-center"
                  style={{ backgroundImage: `url(${photo})` }}
                />
              ))}
            </div>
          </div>
        )}

        <TextAreaField
          label="Description"
          name="description"
          rows={3}
          maxLength={600}
          defaultValue={pitch.description ?? ""}
        />

        <div>
          <button type="submit" disabled={pending} className="btn-t btn-ghost-t !px-4 !py-2 !text-[12.5px]">
            {pending ? "Saving..." : "Save resource changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
