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
      <Table>
        <thead>
          <tr>
            <Th>Number</Th>
            <Th>Customer</Th>
            <Th>Rep</Th>
            <Th>Status</Th>
            <Th>Risk</Th>
            <Th numeric>Lines</Th>
            <Th numeric>Total</Th>
            <Th>Last activity</Th>
            <Th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="row-link" onClick={() => router.push(`/quotations/${r.id}`)}>
              <Td className="num">{r.number}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.company}</span>
                  <TierPill tier={r.tier} />
                </div>
              </Td>
              <Td className="text-muted">{r.rep}</Td>
              <Td>
                <StatusPill status={r.status} />
              </Td>
              <Td>
                <RiskChip blended={r.blended} maxLineOverage={r.maxLineOverage} managerMax={managerMax} />
              </Td>
              <Td numeric>{r.lineCount}</Td>
              <Td numeric>{formatMoney(r.total)}</Td>
              <Td className="text-muted">{relativeTime(r.lastActivityAt)}</Td>
              <Td className="w-10 text-right">
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
