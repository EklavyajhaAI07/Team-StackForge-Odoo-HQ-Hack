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
        "flex flex-col items-start justify-center rounded-[12px] border border-dashed border-border-strong",
        compact ? "px-4 py-5" : "px-6 py-10",
        className,
      )}
    >
      <p className="text-[14px] font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-[52ch] text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
