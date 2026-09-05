"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill, TierPill } from "@/components/ui/Pill";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { IconDownload, IconPrint } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { BASE_CURRENCY, formatMoney, formatPct } from "@/lib/money";
import { buildXlsx, XLSX_MIME, type CellFormat } from "@/lib/xlsx";
import type { ReportRow, ReportTotals } from "@/lib/services/reports";

/**
 * One column list drives both exports, so CSV and XLSX can never drift apart.
 *
 * `value` returns the underlying number for numeric columns rather than a formatted string:
 * the spreadsheet needs a real number to sum, and the CSV writer formats it on the way out.
 */
type ExportColumn = {
  header: string;
  format: CellFormat;
  width?: number;
  value: (r: ReportRow) => string | number;
  total?: (t: ReportTotals) => string | number;
};

/** Paise → rupees. Spreadsheets should hold the unit a person expects to see. */
const rupees = (paise: number) => Math.round(paise) / 100;

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Quotation", format: "text", width: 12, value: (r) => r.number, total: () => "Total" },
  { header: "Created", format: "text", width: 12, value: (r) => r.createdAt.slice(0, 10) },
  { header: "Customer", format: "text", width: 24, value: (r) => r.company },
  { header: "Tier", format: "text", width: 10, value: (r) => r.tier },
  { header: "Rep", format: "text", width: 16, value: (r) => r.repName },
  { header: "Quoted in", format: "text", width: 11, value: (r) => r.currencyCode },
  { header: "Status", format: "text", width: 18, value: (r) => r.status },
  { header: "Lines", format: "number", width: 8, value: (r) => r.lineCount },
  { header: "Units", format: "number", width: 8, value: (r) => r.units, total: (t) => t.units },
  { header: "List value", format: "money", width: 15, value: (r) => rupees(r.listValue), total: (t) => rupees(t.listValue) },
  { header: "Discount", format: "money", width: 15, value: (r) => rupees(r.discountValue), total: (t) => rupees(t.discountValue) },
  { header: "Discount %", format: "percent", width: 12, value: (r) => r.discountPct, total: (t) => t.avgDiscountPct },
  { header: "Net", format: "money", width: 15, value: (r) => rupees(r.netValue), total: (t) => rupees(t.netValue) },
  { header: "Tax", format: "money", width: 13, value: (r) => rupees(r.taxValue), total: (t) => rupees(t.taxValue) },
  { header: "Total", format: "money", width: 15, value: (r) => rupees(r.totalValue), total: (t) => rupees(t.totalValue) },
  { header: "Margin %", format: "percent", width: 11, value: (r) => r.marginPct, total: (t) => t.avgMarginPct },
  { header: "Blended risk (pts)", format: "number", width: 17, value: (r) => r.blendedRisk },
];

function csvCell(value: string | number, format: CellFormat): string {
  // CSV has no formats, so money and percentages are written as plain decimals.
  const s = typeof value === "number" ? (format === "money" ? value.toFixed(2) : format === "percent" ? value.toFixed(1) : String(value)) : value;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, filename: string): void {
  // A local object URL — no server round trip, nothing leaves the machine.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function ReportTable({ rows, totals, summary }: { rows: ReportRow[]; totals: ReportTotals; summary: string }) {
  // Totals only add up in one currency, so the report reports in the base one — and says so
  // whenever the result set actually contains a deal quoted in something else.
  const mixedCurrency = rows.some((r) => r.currencyCode !== BASE_CURRENCY.code);

  function exportCsv() {
    const header = EXPORT_COLUMNS.map((c) => csvCell(c.header, "text")).join(",");
    const body = rows.map((r) => EXPORT_COLUMNS.map((c) => csvCell(c.value(r), c.format)).join(",")).join("\n");
    download(new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" }), `dealflow360-report-${stamp()}.csv`);
  }

  function exportXlsx() {
    const bytes = buildXlsx({
      name: "Quotations",
      columns: EXPORT_COLUMNS.map((c) => ({ header: c.header, format: c.format, width: c.width })),
      rows: rows.map((r) => EXPORT_COLUMNS.map((c) => c.value(r))),
      // Totals go in the sheet as numbers, so the reader can check our arithmetic in Excel.
      totals: EXPORT_COLUMNS.map((c) => c.total?.(totals) ?? null),
    });
    download(new Blob([bytes as BlobPart], { type: XLSX_MIME }), `dealflow360-report-${stamp()}.xlsx`);
  }

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
        {/* On screen the filter summary already sits in the page header; this copy is for the printout. */}
        <div>
          {/* On screen the filter summary already sits in the page header; this copy is for the printout. */}
          <p className="hidden text-[13px] text-muted print-only-block">{summary}</p>
          {mixedCurrency ? (
            <p className="text-[13px] text-muted">
              Amounts are in {BASE_CURRENCY.code}. Deals quoted to a customer in another currency are marked in the
              &ldquo;Quoted in&rdquo; column of the export.
            </p>
          ) : null}
        </div>
        <div className="no-print ml-auto flex gap-2">
          <Button size="sm" variant="secondary" icon={<IconDownload size={14} />} onClick={exportXlsx} disabled={rows.length === 0}>
            Export XLSX
          </Button>
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
