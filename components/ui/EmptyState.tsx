import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
  compact,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-center rounded-[10px] border border-dashed border-border",
        compact ? "px-3.5 py-3.5" : "px-5 py-8",
        className,
      )}
    >
      <p className="text-[13px] font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-[56ch] text-[12px] text-muted">{description}</p> : null}
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  );
}
