import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One compact line: what this screen is, one clause of context, and its actions.
 * Keeping the title near body size is deliberate — in a dense tool the heading is a
 * label, not a billboard, and every pixel it gives back shows another row of data.
 */
export function PageHeader({
  title,
  context,
  actions,
  className,
}: {
  title: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1>{title}</h1>
        {context ? <p className="text-[12px] text-muted">{context}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
