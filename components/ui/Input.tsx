import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// `size` is a native HTML attribute (a number), so the visual size prop is named `dense`.
export function Input({
  className,
  numeric,
  dense,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { numeric?: boolean; dense?: boolean }) {
  return <input className={cn("input", dense && "input-sm", numeric && "input-num", className)} {...rest} />;
}

export function Select({
  className,
  dense,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { dense?: boolean }) {
  return <select className={cn("input", dense && "input-sm", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input", className)} {...rest} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
