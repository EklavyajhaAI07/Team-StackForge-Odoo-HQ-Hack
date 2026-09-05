"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconCheck } from "@/components/ui/icons";

type Decision = "APPROVE" | "REJECT" | "RETURN";

export function ApprovalActions({ quotationId, step, role }: { quotationId: string; step: number; role: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [modal, setModal] = useState<Exclude<Decision, "APPROVE"> | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(decision: Decision, text: string) {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not work");
        return;
      }
      setModal(null);
      setReason("");
      toast({
        title:
          decision === "APPROVE"
            ? data.status === "PENDING_FINANCE"
              ? "Approved — now with finance"
              : "Approved"
            : decision === "REJECT"
              ? "Rejected"
              : "Returned for revision",
        tone: decision === "APPROVE" ? "money" : decision === "REJECT" ? "danger" : "info",
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold">
          Step {step}: {role === "FINANCE" ? "finance" : "sales manager"} decision
        </h3>
        <p className="text-[12px] text-muted">Your name, the time and your reason are written to the audit log.</p>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5">
        <Field label="Note (optional, for approvals)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strategic account, agreed with regional head" rows={2} />
        </Field>
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<IconCheck size={14} />} loading={busy === "APPROVE"} onClick={() => act("APPROVE", note)}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => setModal("RETURN")}>
            Return for revision
          </Button>
          <Button variant="danger" onClick={() => setModal("REJECT")}>
            Reject
          </Button>
        </div>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "REJECT" ? "Reject this quotation" : "Return for revision"}
        description={modal === "REJECT" ? "The rep can reopen it as a draft later. A reason is required." : "It goes back to draft so the rep can change the terms. Say what needs to change."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant={modal === "REJECT" ? "danger" : "primary"} loading={busy !== null} disabled={reason.trim().length < 3} onClick={() => modal && act(modal, reason.trim())}>
              {modal === "REJECT" ? "Reject" : "Return"}
            </Button>
          </>
        }
      >
        <Field label="Reason" error={error}>
          <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Be specific — the rep and the customer trail will see this" />
        </Field>
      </Modal>
    </Card>
  );
}
