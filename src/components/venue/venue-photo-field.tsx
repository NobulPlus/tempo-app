"use client";

import { useEffect, useId, useState } from "react";

export function VenuePhotoField({
  label,
  hint,
  name = "photo",
  multiple = false,
}: {
  label: string;
  hint?: string;
  name?: string;
  multiple?: boolean;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const inputId = useId();

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previews]);

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
          {label}
        </label>
        <input
          id={inputId}
          name={name}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            setPreviews((current) => {
              current.forEach((preview) => URL.revokeObjectURL(preview));
              return files.map((file) => URL.createObjectURL(file));
            });
          }}
          className="input-t file:mr-4 file:rounded-full file:border-0 file:bg-green file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-[#051530]"
        />
        {hint && <p className="mt-1.5 text-[12px] text-ink-muted">{hint}</p>}
      </div>

      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-glass-border bg-glass">
        {previews[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previews[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-[12px] text-ink-muted">
            Preview
          </div>
        )}
      </div>

      {previews.length > 1 && (
        <div className="sm:col-span-2">
          <div className="mb-2 text-[12px] font-semibold text-ink-muted">
            {previews.length} photos selected. First photo becomes the cover.
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {previews.slice(0, 8).map((preview) => (
              <div
                key={preview}
                className="aspect-[4/3] overflow-hidden rounded-lg border border-glass-border bg-glass"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
