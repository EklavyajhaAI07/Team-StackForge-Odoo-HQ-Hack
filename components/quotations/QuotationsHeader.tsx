import Link from "next/link";
import { cn } from "@/lib/cn";
import { IconGrid, IconList } from "@/components/ui/icons";
import { PageHeader } from "@/components/shell/PageHeader";
import { NewQuotationButton, type CustomerOption } from "./NewQuotationButton";

export function QuotationsHeader({
  view,
  count,
  scope,
  customers,
  canCreate,
}: {
  view: "table" | "kanban";
  count: number;
  /** Whose quotations these are, so the caption never overclaims. */
  scope: "mine" | "team";
  customers: CustomerOption[];
  canCreate: boolean;
}) {
  return (
    <PageHeader
      title={view === "table" ? "Quotations" : "Pipeline"}
      context={count === 0 ? "Nothing here yet" : `${count} open and recent ${scope === "team" ? "across the team" : "of yours"}`}
      actions={
        <>
          <div className="flex rounded-[6px] border border-border p-px" role="tablist" aria-label="View">
            <Link
              href="/quotations"
              role="tab"
              aria-selected={view === "table"}
              className={cn(
                "flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-[13px] transition-colors",
                view === "table" ? "bg-raised text-text" : "text-muted hover:text-text",
              )}
            >
              <IconList size={12} /> Table
            </Link>
            <Link
              href="/pipeline"
              role="tab"
              aria-selected={view === "kanban"}
              className={cn(
                "flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-[13px] transition-colors",
                view === "kanban" ? "bg-raised text-text" : "text-muted hover:text-text",
              )}
            >
              <IconGrid size={12} /> Board
            </Link>
          </div>
          {canCreate ? <NewQuotationButton customers={customers} /> : null}
        </>
      }
    />
  );
}
