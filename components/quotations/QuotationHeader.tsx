import Link from "next/link";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { IconChevronRight } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";

export function QuotationHeader({
  quotation,
}: {
  quotation: {
    id: string;
    number: string;
    status: string;
    promisedDate: Date | null;
    createdAt: Date;
    customer: { company: string; name: string; tier: string; city: string };
    rep: { name: string };
  };
}) {
  const q = quotation;
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <nav className="flex items-center gap-1 text-[12px] text-muted" aria-label="Breadcrumb">
          <Link href="/quotations" className="hover:text-text">
            Quotations
          </Link>
          <IconChevronRight size={12} />
          <span className="num">{q.number}</span>
        </nav>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="num text-[30px] font-bold">{q.number}</h1>
          <StatusPill status={q.status} className="mt-1" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <span className="flex items-center gap-2 text-text">
            {q.customer.company}
            <TierPill tier={q.customer.tier} />
          </span>
          <span>
            {q.customer.name} · {q.customer.city}
          </span>
          <span>Rep {q.rep.name}</span>
          <span>Created {formatDate(q.createdAt)}</span>
          {q.promisedDate ? <span>Promised {formatDate(q.promisedDate)}</span> : null}
        </div>
      </div>
    </div>
  );
}
