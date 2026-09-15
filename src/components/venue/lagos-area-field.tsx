"use client";

import { useId } from "react";
import { LAGOS_AREA_OPTIONS } from "@/lib/lagos";
import { PinIcon } from "@/components/icons";

export function LagosAreaField({
  defaultValue,
  floating = false,
}: {
  defaultValue?: string;
  floating?: boolean;
}) {
  const listId = useId();

  if (floating) {
    return (
      <div className="field-t">
        <input
          id="area"
          name="area"
          required
          placeholder=" "
          defaultValue={defaultValue}
          list={listId}
        />
        <span className="field-icon">
          <PinIcon size={18} />
        </span>
        <label htmlFor="area" className="floating">
          Area in Lagos
        </label>
        <AreaOptions id={listId} />
      </div>
    );
  }

  return (
    <label className="field-t block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Area in Lagos</span>
      <input name="area" required defaultValue={defaultValue} list={listId} placeholder="e.g. Yaba, Ajah, Ikorodu" />
      <span className="mt-1.5 block text-[12px] text-ink-muted">
        Choose a Lagos LGA or neighbourhood. You can type a more specific area if needed.
      </span>
      <AreaOptions id={listId} />
    </label>
  );
}

function AreaOptions({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {LAGOS_AREA_OPTIONS.map((area) => (
        <option key={area} value={area} />
      ))}
    </datalist>
  );
}
