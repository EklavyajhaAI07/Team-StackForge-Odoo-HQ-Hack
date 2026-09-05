import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  numeric,
  size,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { numeric?: boolean; size?: "sm" | "md" }) {
  return <input className={cn("input", size === "sm" && "input-sm", numeric && "input-num", className)} {...rest} />;
}

export function Select({
  className,
  size,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { size?: "sm" | "md" }) {
  return <select className={cn("input", size === "sm" && "input-sm", className)} {...rest} />;
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
