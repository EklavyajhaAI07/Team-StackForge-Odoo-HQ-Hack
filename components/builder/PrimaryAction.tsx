"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconCopy, IconSend } from "@/components/ui/icons";
import type { RoutingDecision } from "@/lib/engine/routing";
import type { BuilderPermissions, BuilderQuotation } from "./types";

export function PrimaryAction({
  quotation,
  decision,
  permissions,
  portalUrl,
  lineCount,
}: {
  quotation: BuilderQuotation;
  decision: RoutingDecision;
  permissions: BuilderPermissions;
  portalUrl: string | null;
  lineCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState<string | null>(portalUrl);
  const base = `/quotations/${quotation.id}`;

  async function post(path: string): Promise<Record<string, unknown> | null> {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        toast({ title: (data.error as string) ?? "That did not work", tone: "danger" });
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const data = await post("submit");
    if (!data) return;
    if (data.status === "APPROVED") {
      toast({ title: "Auto-approved — within policy", description: "No approval step was needed. Continue to fulfillment.", tone: "money" });
      router.push(`${base}/fulfillment`);
    } else {
      const d = data.decision as RoutingDecision;
      toast({
        title: d.kind === "MANAGER" ? "Routed to manager approval" : "Routed to manager, then finance",
        description: d.reason,
        tone: "warn",
      });
      router.push(`${base}/approval`);
    }
    router.refresh();
  }

  async function send() {
    const data = await post("send");
    if (!data) return;
    setLink(data.url as string);
    setLinkOpen(true);
    toast({ title: "Portal link ready", description: "Copy it and open it in a private window to play the customer.", tone: "info" });
    router.refresh();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", tone: "money", durationMs: 1600 });
    } catch {
      toast({ title: "Select the link and copy it manually", tone: "warn" });
    }
  }

  async function revise() {
    const data = await post("revise");
    if (data) {
      toast({ title: "Reopened as draft", tone: "info" });
      router.refresh();
    }
  }

  const s = quotation.status;

  let body: React.ReactNode;
  if (s === "DRAFT") {
    const auto = decision.kind === "AUTO_APPROVED";
    body = permissions.canSubmit ? (
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" className="w-full" disabled={lineCount === 0} loading={busy} onClick={submit}>
          {auto ? "Confirm & fulfil" : "Send for approval"}
        </Button>
        {/* A draft can be shown to the customer to read and comment on. They cannot confirm
            it — approval gates acceptance, not viewing. */}
        {link ? (
          <Button variant="secondary" className="w-full" icon={<IconCopy size={14} />} onClick={() => copy(link)}>
            Copy portal link
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="w-full" disabled={lineCount === 0} loading={busy} onClick={send}>
            Share a draft link
          </Button>
        )}
      </div>
    ) : (
      <p className="text-[13px] text-muted">Only the owning rep (or a manager) can submit this draft.</p>
    );
  } else if (s === "PENDING_MANAGER" || s === "PENDING_FINANCE") {
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-warn">Waiting for {s === "PENDING_MANAGER" ? "the sales manager" : "finance"} — lines are locked.</p>
        <LinkButton href={`${base}/approval`} variant="secondary" className="w-full">
          View approval
        </LinkButton>
      </div>
    );
  } else if (s === "APPROVED") {
    body = (
      <div className="flex flex-col gap-2">
        {permissions.canSubmit ? (
          <Button variant="primary" size="lg" className="w-full" icon={<IconSend size={14} />} loading={busy} onClick={send}>
            Send to customer
          </Button>
        ) : null}
        <LinkButton href={`${base}/fulfillment`} variant="secondary" className="w-full">
          Confirm order internally
        </LinkButton>
      </div>
    );
  } else if (s === "SENT" || s === "UNDER_NEGOTIATION") {
    body = (
      <div className="flex flex-col gap-2">
        {link ? (
          <Button variant="primary" size="lg" className="w-full" icon={<IconCopy size={14} />} onClick={() => copy(link)}>
            Copy portal link
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {permissions.canSubmit ? (
            <Button variant="ghost" size="sm" loading={busy} onClick={send}>
              {link ? "Send a fresh link" : "Send to customer"}
            </Button>
          ) : null}
          <LinkButton href={`${base}/fulfillment`} variant="secondary" size="sm">
            Confirm order
          </LinkButton>
        </div>
      </div>
    );
  } else if (s === "CONFIRMED") {
    body = (
      <LinkButton href={`${base}/fulfillment`} variant="primary" className="w-full">
        Open fulfillment
      </LinkButton>
    );
  } else if (s === "REJECTED") {
    body = permissions.canRevise ? (
      <Button variant="secondary" className="w-full" loading={busy} onClick={revise}>
        Revise quotation
      </Button>
    ) : (
      <p className="text-[13px] text-muted">Rejected — the owning rep can reopen it.</p>
    );
  }

  return (
    <>
      {body}
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Customer portal link"
        description="Valid for 72 hours. No email is sent — paste it wherever the customer is."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Done
            </Button>
            {link ? (
              <Button variant="primary" icon={<IconCopy size={14} />} onClick={() => copy(link)}>
                Copy link
              </Button>
            ) : null}
          </>
        }
      >
        <code className="num block break-all rounded-[8px] border border-border bg-bg px-3 py-2 text-[13px]">{link}</code>
      </Modal>
    </>
  );
}
