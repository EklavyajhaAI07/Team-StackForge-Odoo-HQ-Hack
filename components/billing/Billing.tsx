"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { INVOICE_STATUS, Pill, StatusPill } from "@/components/ui/Pill";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { formatMoney, type DisplayCurrency } from "@/lib/money";

export type BillingInvoice = {
  id: string;
  kind: "ONE_TIME" | "RECURRING" | "CREDIT_NOTE";
  amount: number;
  tax: number;
  status: "DRAFT" | "POSTED" | "PAID";
  dueDate: string | null;
  payments: { id: string; amount: number; method: string; paidAt: string }[];
};

export type BillingScheduleEntry = {
  id: string;
  lineId: string;
  productName: string;
  planName: string;
  billOn: string;
  amount: number;
  status: "SCHEDULED" | "INVOICED";
};

export type BillingSubscription = {
  id: string;
  productName: string;
  qty: number;
  netUnit: number;
  planName: string;
  cancelRule: "PRORATED_CREDIT" | "NO_REFUND";
};

type ProrationPreview = {
  line: { id: string; name: string; currentQty: number; newQty: number; planName: string };
  cycle: { start: string; end: string; periodDays: number; remainingDays: number };
  result: { kind: "INVOICE" | "CREDIT_NOTE" | "NONE"; amount: number; newCycleAmount: number; explanation: string };
};

type CancellationPreview = {
  line: { id: string; name: string; qty: number; planName: string; cancelRule: string };
  cycle: { start: string; end: string; periodDays: number; remainingDays: number };
  result: { kind: "INVOICE" | "CREDIT_NOTE" | "NONE"; amount: number; explanation: string };
};

const today = () => new Date().toISOString().slice(0, 10);

function kindLabel(kind: BillingInvoice["kind"]): string {
  if (kind === "ONE_TIME") return "One-time";
  if (kind === "RECURRING") return "Recurring";
  return "Credit note";
}

function kindTone(kind: BillingInvoice["kind"]): "neutral" | "primary" | "money" {
  return kind === "CREDIT_NOTE" ? "money" : kind === "RECURRING" ? "primary" : "neutral";
}

function rupeesInput(paise: number): string {
  return (paise / 100).toFixed(2);
}

function parseRupees(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function previewTone(kind: "INVOICE" | "CREDIT_NOTE" | "NONE"): "money" | "warn" | "neutral" {
  return kind === "CREDIT_NOTE" ? "money" : kind === "INVOICE" ? "warn" : "neutral";
}

export function Billing({
  orderId,
  invoices,
  schedule,
  subscriptions,
  canManage,
  nowIso,
  currency,
}: {
  orderId: string;
  invoices: BillingInvoice[];
  schedule: BillingScheduleEntry[];
  subscriptions: BillingSubscription[];
  canManage: boolean;
  nowIso: string;
  /** Invoices, schedule and credit notes are all stated in what the customer is billed. */
  currency: DisplayCurrency;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const asOf = new Date(nowIso).getTime();
  const [busy, setBusy] = useState<string | null>(null);
  const [quantityLine, setQuantityLine] = useState<BillingSubscription | null>(null);
  const [newQty, setNewQty] = useState("");
  const [effectiveAt, setEffectiveAt] = useState(today);
  const [quantityPreview, setQuantityPreview] = useState<ProrationPreview | null>(null);
  const [cancelLine, setCancelLine] = useState<BillingSubscription | null>(null);
  const [cancelPreview, setCancelPreview] = useState<CancellationPreview | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<BillingInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");

  const totals = useMemo(() => {
    const billable = invoices.filter((invoice) => invoice.kind !== "CREDIT_NOTE");
    const invoiced = billable.reduce((sum, invoice) => sum + invoice.amount + invoice.tax, 0);
    const received = billable.reduce((sum, invoice) => sum + invoice.payments.reduce((paid, payment) => paid + payment.amount, 0), 0);
    const credits = invoices.filter((invoice) => invoice.kind === "CREDIT_NOTE").reduce((sum, invoice) => sum + invoice.amount + invoice.tax, 0);
    return { invoiced, received, outstanding: invoiced - received, credits };
  }, [invoices]);

  async function request<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const response = await fetch(`/api/orders/${orderId}/billing/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) {
        toast({ title: data.error ?? "That did not work", tone: "danger" });
        return null;
      }
      return data;
    } catch {
      toast({ title: "Could not reach the server", tone: "danger" });
      return null;
    }
  }

  async function generateInvoice(entry: BillingScheduleEntry) {
    setBusy(`invoice:${entry.id}`);
    try {
      const result = await request<{ invoice: { amount: number } }>("invoice", { entryId: entry.id });
      if (result) {
        toast({ title: "Recurring invoice posted", description: formatMoney(result.invoice.amount, { currency }), tone: "money" });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  function openQuantity(line: BillingSubscription) {
    setQuantityLine(line);
    setNewQty(String(line.qty));
    setEffectiveAt(today());
    setQuantityPreview(null);
  }

  async function previewQuantity() {
    if (!quantityLine) return;
    const qty = Number(newQty);
    if (!Number.isInteger(qty) || qty < 1) {
      toast({ title: "Enter a quantity of at least 1", tone: "danger" });
      return;
    }
    setBusy("quantity-preview");
    try {
      const result = await request<ProrationPreview>("prorate", { lineId: quantityLine.id, newQty: qty, effectiveAt, mode: "PREVIEW" });
      if (result) setQuantityPreview(result);
    } finally {
      setBusy(null);
    }
  }

  async function applyQuantity() {
    if (!quantityLine || !quantityPreview) return;
    setBusy("quantity-apply");
    try {
      const result = await request<{ invoice: { id: string } | null }>("prorate", {
        lineId: quantityLine.id,
        newQty: Number(newQty),
        effectiveAt,
        mode: "APPLY",
      });
      if (result) {
        toast({ title: "Subscription quantity updated", description: quantityPreview.result.explanation, tone: "money" });
        setQuantityLine(null);
        setQuantityPreview(null);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  function openCancellation(line: BillingSubscription) {
    setCancelLine(line);
    setEffectiveAt(today());
    setCancelPreview(null);
  }

  async function previewCancel() {
    if (!cancelLine) return;
    setBusy("cancel-preview");
    try {
      const result = await request<CancellationPreview>("cancel", { lineId: cancelLine.id, effectiveAt, mode: "PREVIEW" });
      if (result) setCancelPreview(result);
    } finally {
      setBusy(null);
    }
  }

  async function applyCancel() {
    if (!cancelLine || !cancelPreview) return;
    setBusy("cancel-apply");
    try {
      const result = await request<{ creditNote: { id: string } | null }>("cancel", { lineId: cancelLine.id, effectiveAt, mode: "APPLY" });
      if (result) {
        toast({ title: "Subscription line cancelled", description: cancelPreview.result.explanation, tone: "money" });
        setCancelLine(null);
        setCancelPreview(null);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  function openPayment(invoice: BillingInvoice) {
    const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    setPaymentInvoice(invoice);
    setPaymentAmount(rupeesInput(invoice.amount + invoice.tax - paid));
    setPaymentMethod("UPI");
  }

  async function applyPayment() {
    if (!paymentInvoice) return;
    const amount = parseRupees(paymentAmount);
    if (!amount) {
      toast({ title: "Enter a valid payment amount", tone: "danger" });
      return;
    }
    setBusy("payment");
    try {
      const result = await request<{ status: string; outstandingAfter: number }>("payment", {
        invoiceId: paymentInvoice.id,
        amount,
        method: paymentMethod,
      });
      if (result) {
        toast({ title: result.status === "PAID" ? "Invoice paid" : "Payment recorded", description: result.outstandingAfter ? `${formatMoney(result.outstandingAfter, { currency })} remains` : "Balance cleared", tone: "money" });
        setPaymentInvoice(null);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2>Billing & collection</h2>
        <p className="mt-1 text-[14px] text-muted">One-time billing, recurring cycles, proration and payment history for this order.</p>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Invoiced" value={formatMoney(totals.invoiced, { currency })} />
        <Metric label="Received" value={formatMoney(totals.received, { currency })} tone="money" />
        <Metric label="Outstanding" value={formatMoney(totals.outstanding, { currency })} tone={totals.outstanding > 0 ? "warn" : "money"} />
        <Metric label="Credit notes" value={formatMoney(totals.credits, { currency })} tone="money" />
      </div>

      <Card>
        <CardHeader title="Invoices" description="One-time, recurring and credit-note documents. Amounts include tax in the total column." />
        {invoices.length === 0 ? (
          <CardBody><p className="text-[14px] text-muted">No invoices have been posted yet.</p></CardBody>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><Th>Type</Th><Th>Due</Th><Th numeric>Net</Th><Th numeric>Tax</Th><Th numeric>Total</Th><Th>Status</Th><Th numeric>Received</Th>{canManage ? <Th aria-label="Actions" /> : null}</tr></thead>
              <tbody>
                {invoices.map((invoice) => {
                  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
                  const total = invoice.amount + invoice.tax;
                  const credit = invoice.kind === "CREDIT_NOTE";
                  return (
                    <tr key={invoice.id}>
                      <Td><Pill tone={kindTone(invoice.kind)}>{kindLabel(invoice.kind)}</Pill></Td>
                      <Td className="text-muted">{invoice.dueDate ? formatDate(invoice.dueDate) : credit ? "Issued credit" : "—"}</Td>
                      <Td numeric className={credit ? "text-money" : undefined}>{credit ? "−" : ""}{formatMoney(invoice.amount, { currency })}</Td>
                      <Td numeric className={credit ? "text-money" : undefined}>{credit ? "−" : ""}{formatMoney(invoice.tax, { currency })}</Td>
                      <Td numeric className={cn("font-medium", credit && "text-money")}>{credit ? "−" : ""}{formatMoney(total, { currency })}</Td>
                      <Td><StatusPill status={invoice.status} map={INVOICE_STATUS} /></Td>
                      <Td numeric>{credit ? "—" : formatMoney(paid, { currency })}</Td>
                      {canManage ? <Td className="text-right">{invoice.status === "POSTED" && !credit ? <Button size="sm" variant="money" onClick={() => openPayment(invoice)}>Record payment</Button> : null}</Td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="Recurring schedule" description="The next three cycles created when the order was confirmed. Generate an invoice when a scheduled cycle is due." />
        {schedule.length === 0 ? (
          <CardBody><p className="text-[14px] text-muted">This order has no recurring subscription lines.</p></CardBody>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><Th>Subscription</Th><Th>Bill on</Th><Th numeric>Amount</Th><Th>Status</Th>{canManage ? <Th aria-label="Actions" /> : null}</tr></thead>
              <tbody>
                {schedule.map((entry) => {
                  const due = new Date(entry.billOn).getTime() <= asOf;
                  return (
                    <tr key={entry.id}>
                      <Td><div className="font-medium">{entry.productName}</div><div className="text-[12px] text-muted">{entry.planName}</div></Td>
                      <Td className="num">{formatDate(entry.billOn)}</Td>
                      <Td numeric>{formatMoney(entry.amount, { currency })}</Td>
                      <Td><Pill tone={entry.status === "INVOICED" ? "money" : due ? "warn" : "neutral"}>{entry.status === "INVOICED" ? "Invoiced" : due ? "Due now" : "Scheduled"}</Pill></Td>
                      {canManage ? <Td className="text-right">{entry.status === "SCHEDULED" ? <Button size="sm" variant="secondary" disabled={!due} loading={busy === `invoice:${entry.id}`} onClick={() => generateInvoice(entry)}>{due ? "Generate invoice" : "Not due"}</Button> : null}</Td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {subscriptions.length > 0 ? (
        <Card>
          <CardHeader title="Subscription changes" description="A change creates a transparent proration preview before it is applied. Cancelled lines retain their audit trail." />
          <TableWrap>
            <Table>
              <thead><tr><Th>Subscription</Th><Th numeric>Quantity</Th><Th numeric>Net / unit</Th><Th>Cancellation policy</Th>{canManage ? <Th aria-label="Actions" /> : null}</tr></thead>
              <tbody>
                {subscriptions.map((line) => (
                  <tr key={line.id}>
                    <Td><div className="font-medium">{line.productName}</div><div className="text-[12px] text-muted">{line.planName}</div></Td>
                    <Td numeric className={line.qty === 0 ? "text-muted" : undefined}>{line.qty === 0 ? "Cancelled" : line.qty}</Td>
                    <Td numeric>{formatMoney(line.netUnit, { currency })}</Td>
                    <Td><Pill tone={line.cancelRule === "PRORATED_CREDIT" ? "money" : "neutral"}>{line.cancelRule === "PRORATED_CREDIT" ? "Prorated credit" : "No refund"}</Pill></Td>
                    {canManage ? <Td className="text-right">{line.qty > 0 ? <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => openQuantity(line)}>Change qty</Button><Button size="sm" variant="danger" onClick={() => openCancellation(line)}>Cancel</Button></div> : null}</Td> : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      {!canManage ? <p className="text-[13px] text-muted">Billing is read-only for your role. Finance or an admin can manage invoices, payments and subscription changes.</p> : null}

      <Modal open={!!quantityLine} onClose={() => setQuantityLine(null)} title="Change subscription quantity" description={quantityLine ? `${quantityLine.productName} · ${quantityLine.planName}` : undefined} footer={<><Button variant="ghost" onClick={() => setQuantityLine(null)}>Cancel</Button><Button variant="secondary" loading={busy === "quantity-preview"} onClick={previewQuantity}>Preview proration</Button><Button variant="primary" disabled={!quantityPreview} loading={busy === "quantity-apply"} onClick={applyQuantity}>Apply change</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="New quantity"><Input numeric type="number" min={1} value={newQty} onChange={(event) => { setNewQty(event.target.value); setQuantityPreview(null); }} /></Field>
          <Field label="Effective date"><Input type="date" value={effectiveAt} onChange={(event) => { setEffectiveAt(event.target.value); setQuantityPreview(null); }} /></Field>
          {quantityPreview ? <PreviewCard currency={currency} preview={quantityPreview} /> : <p className="text-[13px] text-muted">Preview first to see the current-cycle charge or credit before changing future billing entries.</p>}
        </div>
      </Modal>

      <Modal open={!!cancelLine} onClose={() => setCancelLine(null)} title="Cancel subscription line" description={cancelLine ? `${cancelLine.productName} · ${cancelLine.cancelRule === "PRORATED_CREDIT" ? "prorated credit policy" : "no-refund policy"}` : undefined} footer={<><Button variant="ghost" onClick={() => setCancelLine(null)}>Keep subscription</Button><Button variant="secondary" loading={busy === "cancel-preview"} onClick={previewCancel}>Preview cancellation</Button><Button variant="danger" disabled={!cancelPreview} loading={busy === "cancel-apply"} onClick={applyCancel}>Cancel line</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Effective date"><Input type="date" value={effectiveAt} onChange={(event) => { setEffectiveAt(event.target.value); setCancelPreview(null); }} /></Field>
          {cancelPreview ? <CancellationCard currency={currency} preview={cancelPreview} /> : <p className="text-[13px] text-muted">Future billing entries will be removed. Preview to see whether the current cycle also receives a credit note.</p>}
        </div>
      </Modal>

      <Modal open={!!paymentInvoice} onClose={() => setPaymentInvoice(null)} title="Record payment" description={paymentInvoice ? `${kindLabel(paymentInvoice.kind)} invoice · ${formatMoney(paymentInvoice.amount + paymentInvoice.tax, { currency })} total` : undefined} footer={<><Button variant="ghost" onClick={() => setPaymentInvoice(null)}>Cancel</Button><Button variant="money" loading={busy === "payment"} onClick={applyPayment}>Record payment</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Amount received (₹)"><Input numeric inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></Field>
          <Field label="Method"><Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>UPI</option><option>Bank transfer</option><option>Card</option><option>Cheque</option><option>Cash</option></Select></Field>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "money" | "warn" }) {
  return <Card className="px-4 py-3"><p className="text-[13px] text-muted">{label}</p><p className={cn("num mt-1 text-[22px] font-semibold", tone === "money" && "text-money", tone === "warn" && "text-warn")}>{value}</p></Card>;
}

function PreviewCard({ preview, currency }: { preview: ProrationPreview; currency: DisplayCurrency }) {
  const result = preview.result;
  const label = result.kind === "INVOICE" ? "Prorated charge" : result.kind === "CREDIT_NOTE" ? "Prorated credit" : "No current-cycle document";
  return <div className="rounded-[8px] border border-border bg-bg/40 px-3 py-3"><div className="flex items-center justify-between gap-3"><Pill tone={previewTone(result.kind)}>{label}</Pill><span className={cn("num font-semibold", result.kind === "CREDIT_NOTE" && "text-money")}>{result.amount ? `${result.kind === "CREDIT_NOTE" ? "−" : "+"}${formatMoney(result.amount, { currency })}` : "—"}</span></div><p className="mt-2 text-[14px] text-muted">{result.explanation}</p><p className="mt-1 text-[13px] text-muted">{preview.cycle.remainingDays} of {preview.cycle.periodDays} days remain · future cycle: <span className="num">{formatMoney(result.newCycleAmount, { currency })}</span></p></div>;
}

function CancellationCard({ preview, currency }: { preview: CancellationPreview; currency: DisplayCurrency }) {
  const result = preview.result;
  return <div className="rounded-[8px] border border-border bg-bg/40 px-3 py-3"><div className="flex items-center justify-between gap-3"><Pill tone={previewTone(result.kind)}>{result.kind === "CREDIT_NOTE" ? "Credit note" : "No credit note"}</Pill>{result.amount ? <span className="num font-semibold text-money">−{formatMoney(result.amount, { currency })}</span> : null}</div><p className="mt-2 text-[14px] text-muted">{result.explanation}</p><p className="mt-1 text-[13px] text-muted">{preview.cycle.remainingDays} of {preview.cycle.periodDays} days remain. Future scheduled cycles will be removed.</p></div>;
}
