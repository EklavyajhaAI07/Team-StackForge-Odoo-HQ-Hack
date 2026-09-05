"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { IconBox } from "@/components/ui/icons";
import { QUOTE_STATUS } from "@/components/ui/Pill";

export function ConfirmOrderPanel({
  quotationId,
  status,
  canConfirm,
  physicalLines,
  recurringLines,
}: {
  quotationId: string;
  status: string;
  canConfirm: boolean;
  physicalLines: number;
  recurringLines: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = ["APPROVED", "SENT", "UNDER_NEGOTIATION"].includes(status);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not confirm the order");
        return;
      }
      toast({ title: "Order confirmed", description: "Invoices and the billing schedule are ready.", tone: "money" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <EmptyState
        title="No order yet"
        description={`This quotation is ${QUOTE_STATUS[status]?.label.toLowerCase() ?? status.toLowerCase()}. Fulfillment opens once it is approved and confirmed.`}
      />
    );
  }

  return (
    <Card className="max-w-[640px]">
      <div className="px-5 pt-5">
        <h3 className="text-[15px] font-semibold">Confirm the order</h3>
        <p className="mt-1 text-[13px] text-muted">
          Confirming creates the order, posts the one-time invoice and lays down the recurring billing schedule. Then the warehouse split is computed.
        </p>
        <ul className="mt-4 flex flex-col gap-1.5 text-[13px]">
          <li className="flex items-center gap-2">
            <IconBox size={14} className="text-muted" />
            {physicalLines} physical line{physicalLines === 1 ? "" : "s"} to ship
          </li>
          <li className="flex items-center gap-2">
            <IconBox size={14} className="text-muted" />
            {recurringLines} subscription line{recurringLines === 1 ? "" : "s"} to schedule
          </li>
        </ul>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
      </div>
      <div className="px-5 pb-5 pt-4">
        {canConfirm ? (
          <Button variant="primary" size="lg" loading={busy} onClick={confirm}>
            Confirm order
          </Button>
        ) : (
          <p className="text-[13px] text-muted">
            The owning rep, their sales manager or an admin confirms the order. Fulfillment and billing open to finance once they have.
          </p>
        )}
      </div>
    </Card>
  );
}
