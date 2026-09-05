import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, raised, ...rest }: HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return <div className={cn("card", raised && "card-raised", className)} {...rest} />;
}

/** Card headers sit on a rule rather than floating, so a card reads as a titled panel. */
export function CardHeader({
  title,
  description,
  actions,
  className,
  bordered = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3",
        bordered && "border-b border-border",
        className,
      )}
    >
      <div className="min-w-0">
        <h2>{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-3", className)} {...rest} />;
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={className}>{children}</h2>;
}
