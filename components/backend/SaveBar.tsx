"use client";

import { Button } from "@/components/ui/Button";

/** Shared header row for the plain-CRUD backend screens. */
export function SaveBar({
  title,
  description,
  dirty,
  busy,
  disabled,
  onSave,
  label = "Save changes",
  extra,
}: {
  title: string;
  description: string;
  dirty: boolean;
  busy: boolean;
  disabled?: boolean;
  onSave: () => void;
  label?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
      <div>
        <h2>{title}</h2>
        <p className="text-[13px] text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        {/* Without this, a greyed-out button is ambiguous: broken, forbidden, or simply
            nothing to save yet? Name the state. */}
        <span className="text-[13px] text-faint">
          {disabled && !dirty ? "Read-only" : dirty ? "Unsaved changes" : "No changes yet"}
        </span>
        <Button variant="primary" loading={busy} disabled={!dirty || disabled} onClick={onSave}>
          {label}
        </Button>
      </div>
    </div>
  );
}
