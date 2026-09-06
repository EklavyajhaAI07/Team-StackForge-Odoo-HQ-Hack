import Link from "next/link";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { IconChevronRight } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { PortalLinkButton } from "./PortalLinkButton";
import { BASE_CURRENCY } from "@/lib/money";

export function QuotationHeader({
  quotation,
  portalUrl,
}: {
  quotation: {
    id: string;
    number: string;
    status: string;
    promisedDate: Date | null;
    createdAt: Date;
    customer: { company: string; name: string; tier: string; city: string };
    rep: { name: string };
    currencyCode: string;
    fxRate: number;
  };
  /** The live customer link, when one has been issued. Null before the quotation is sent. */
  portalUrl?: string | null;
}) {
  const q = quotation;
  // Only worth saying when it is not the ledger currency — otherwise it is noise on every screen.
  const foreign = q.currencyCode !== BASE_CURRENCY.code;
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <nav className="flex items-center gap-1 text-[13px] text-muted" aria-label="Breadcrumb">
          <Link href="/quotations" className="hover:text-text">
            Quotations
          </Link>
          <IconChevronRight size={12} />
          <span className="num">{q.number}</span>
        </nav>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="num text-[34px] font-bold">{q.number}</h1>
          <StatusPill status={q.status} className="mt-1" />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
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
          {foreign ? (
            <span className="text-warn" title="Rate captured when this quotation was created, so it cannot move underneath a sent quote">
              {`Quoted in ${q.currencyCode} at ${q.fxRate} per ${BASE_CURRENCY.symbol}1`}
            </span>
          ) : null}
        </div>
      </div>
      {/* Every tab can hand the customer their document; only the builder can mint the link. */}
      {portalUrl ? (
        <div className="shrink-0">
          <PortalLinkButton url={portalUrl} />
        </div>
      ) : null}
    </div>
  );
}
