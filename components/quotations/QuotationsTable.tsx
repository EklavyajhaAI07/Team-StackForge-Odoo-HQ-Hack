"use client";

import { useRouter } from "next/navigation";
import { Kebab } from "@/components/ui/Kebab";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { formatMoney } from "@/lib/money";
import { relativeTime } from "@/lib/format";
import { RiskChip } from "./RiskChip";

export type QuotationRow = {
  id: string;
  number: string;
  company: string;
  tier: string;
  rep: string;
  status: string;
  total: number;
  blended: number;
  maxLineOverage: number;
  lastActivityAt: string;
  lineCount: number;
};

export function QuotationsTable({ rows, managerMax }: { rows: QuotationRow[]; managerMax: number }) {
  const router = useRouter();
  return (
    <TableWrap>
      <Table className="table-fixed min-w-[1080px]">
        {/* Explicit widths stop eight columns from drifting apart across a wide screen.
            Each is sized so its longest real value fits on one line. */}
        <colgroup>
          <col className="w-[132px]" />
          {/* Only the customer column breathes; the rest hold their width. */}
          <col />
          <col className="w-[124px]" />
          <col className="w-[152px]" />
          <col className="w-[124px]" />
          <col className="w-[62px]" />
          <col className="w-[126px]" />
          <col className="w-[96px]" />
          <col className="w-[40px]" />
        </colgroup>
        <thead>
          <tr>
            <Th>Number</Th>
            <Th>Customer</Th>
            <Th>Rep</Th>
            <Th>Status</Th>
            <Th>Risk</Th>
            <Th numeric>Lines</Th>
            <Th numeric>Total</Th>
            <Th>Activity</Th>
            <Th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="row-link" onClick={() => router.push(`/quotations/${r.id}`)}>
              {/* Identifiers are mono but stay left-aligned under their own header. */}
              <Td className="num text-left text-text-dim">{r.number}</Td>
              <Td>
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.company}</span>
                  <TierPill tier={r.tier} />
                </span>
              </Td>
              <Td className="truncate text-muted">{r.rep}</Td>
              <Td>
                <StatusPill status={r.status} />
              </Td>
              <Td>
                <RiskChip blended={r.blended} maxLineOverage={r.maxLineOverage} managerMax={managerMax} />
              </Td>
              <Td numeric className="num text-muted">
                {r.lineCount}
              </Td>
              <Td numeric>{formatMoney(r.total, { whole: true })}</Td>
              <Td className="text-muted">{relativeTime(r.lastActivityAt)}</Td>
              <Td className="text-right">
                <Kebab
                  items={[
                    { label: "Open builder", href: `/quotations/${r.id}` },
                    { label: "Approval & audit", href: `/quotations/${r.id}/approval` },
                    { label: "Fulfillment", href: `/quotations/${r.id}/fulfillment` },
                    { label: "Billing", href: `/quotations/${r.id}/billing` },
                  ]}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
