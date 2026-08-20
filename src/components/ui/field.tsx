import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

interface WrapProps {
  label: string;
  hint?: string;
  className?: string;
}

export function Field({
  label,
  hint,
  className = "",
  ...rest
}: WrapProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`field-t block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      <input {...rest} />
      {hint && <span className="mt-1.5 block text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  className = "",
  ...rest
}: WrapProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`field-t block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      <textarea {...rest} />
      {hint && <span className="mt-1.5 block text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  className = "",
  children,
  ...rest
}: WrapProps &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & { children: ReactNode }) {
  return (
    <label className={`field-t block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      <select {...rest}>{children}</select>
      {hint && <span className="mt-1.5 block text-[12px] text-ink-muted">{hint}</span>}
    </label>
  );
}
