"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { IconDownload, IconPrint } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { formatMoney, formatPct } from "@/lib/money";
import type { ReportRow, ReportTotals } from "@/lib/services/reports";

const CSV_COLUMNS: { header: string; value: (r: ReportRow) => string | number }[] = [
  { header: "Quotation", value: (r) => r.number },
  { header: "Created", value: (r) => r.createdAt.slice(0, 10) },
  { header: "Customer", value: (r) => r.company },
  { header: "Tier", value: (r) => r.tier },
  { header: "Rep", value: (r) => r.repName },
  { header: "Status", value: (r) => r.status },
  { header: "Lines", value: (r) => r.lineCount },
  { header: "Units", value: (r) => r.units },
  { header: "List value (INR)", value: (r) => (r.listValue / 100).toFixed(2) },
  { header: "Discount (INR)", value: (r) => (r.discountValue / 100).toFixed(2) },
  { header: "Discount %", value: (r) => r.discountPct.toFixed(1) },
  { header: "Net (INR)", value: (r) => (r.netValue / 100).toFixed(2) },
  { header: "Tax (INR)", value: (r) => (r.taxValue / 100).toFixed(2) },
  { header: "Total (INR)", value: (r) => (r.totalValue / 100).toFixed(2) },
  { header: "Margin %", value: (r) => r.marginPct.toFixed(1) },
  { header: "Blended risk (pts)", value: (r) => r.blendedRisk.toFixed(2) },
];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ReportTable({ rows, totals, summary }: { rows: ReportRow[]; totals: ReportTotals; summary: string }) {
  function exportCsv() {
    const header = CSV_COLUMNS.map((c) => csvCell(c.header)).join(",");
    const body = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(c.value(r))).join(",")).join("\n");
    // A local blob download — no server round trip, nothing leaves the machine.
    const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dealflow360-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
        {/* On screen the filter summary already sits in the page header; this copy is for the printout. */}
        <p className="hidden text-[13px] text-muted print-only-block">{summary}</p>
        <div className="no-print ml-auto flex gap-2">
          <Button size="sm" variant="secondary" icon={<IconDownload size={14} />} onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" icon={<IconPrint size={14} />} onClick={() => window.print()} disabled={rows.length === 0}>
            Print / PDF
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No quotations match these filters" description="Widen the period, or clear a filter to see more." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Quotation</Th>
                <Th>Created</Th>
                <Th>Customer</Th>
                <Th>Rep</Th>
                <Th>Status</Th>
                <Th numeric>Units</Th>
                <Th numeric>List</Th>
                <Th numeric>Discount</Th>
                <Th numeric>Total</Th>
                <Th numeric>Margin</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="num">
                    <Link href={`/quotations/${r.id}`} className="hover:text-primary">
                      {r.number}
                    </Link>
                  </Td>
                  <Td className="num text-muted">{formatDate(r.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span>{r.company}</span>
                      <TierPill tier={r.tier} />
                    </div>
                  </Td>
                  <Td className="text-muted">{r.repName}</Td>
                  <Td>
                    <StatusPill status={r.status} />
                  </Td>
                  <Td numeric>{r.units}</Td>
                  <Td numeric>{formatMoney(r.listValue, { whole: true })}</Td>
                  <Td numeric className={r.discountPct > 0 ? "num text-danger" : "num"}>
                    {formatPct(r.discountPct)}
                  </Td>
                  <Td numeric>{formatMoney(r.totalValue, { whole: true })}</Td>
                  <Td numeric className={r.marginPct < 15 ? "num text-warn" : "num text-money"}>
                    {formatPct(r.marginPct)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>
                  {totals.quotations} quotation{totals.quotations === 1 ? "" : "s"}
                </td>
                <td className="num">{totals.units}</td>
                <td className="num">{formatMoney(totals.listValue, { whole: true })}</td>
                <td className="num">{formatPct(totals.avgDiscountPct)}</td>
                <td className="num">{formatMoney(totals.totalValue, { whole: true })}</td>
                <td className="num">{formatPct(totals.avgMarginPct)}</td>
              </tr>
            </tfoot>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
