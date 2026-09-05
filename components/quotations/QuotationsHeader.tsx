import Link from "next/link";
import { cn } from "@/lib/cn";
import { IconGrid, IconList } from "@/components/ui/icons";
import { NewQuotationButton, type CustomerOption } from "./NewQuotationButton";

export function QuotationsHeader({
  view,
  count,
  customers,
  canCreate,
}: {
  view: "table" | "kanban";
  count: number;
  customers: CustomerOption[];
  canCreate: boolean;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1>{view === "table" ? "Quotations" : "Pipeline"}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {count} open and recent quotation{count === 1 ? "" : "s"} across the team
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-[8px] border border-border-strong bg-surface p-0.5" role="tablist" aria-label="View">
          <Link
            href="/quotations"
            role="tab"
            aria-selected={view === "table"}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px]",
              view === "table" ? "bg-raised text-text" : "text-muted hover:text-text",
            )}
          >
            <IconList size={14} /> Table
          </Link>
          <Link
            href="/pipeline"
            role="tab"
            aria-selected={view === "kanban"}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[13px]",
              view === "kanban" ? "bg-raised text-text" : "text-muted hover:text-text",
            )}
          >
            <IconGrid size={14} /> Kanban
          </Link>
        </div>
        {canCreate ? <NewQuotationButton customers={customers} /> : null}
      </div>
    </div>
  );
}
