"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TierPill } from "@/components/ui/Pill";
import { IconPlus } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type CustomerOption = { id: string; company: string; name: string; tier: string; city: string };

export function NewQuotationButton({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create the quotation");
        return;
      }
      setOpen(false);
      router.push(`/quotations/${data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setOpen(true)}>
        New quotation
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New quotation"
        description="Pick the customer. Their tier sets list prices and discount ceilings."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} disabled={!selected} loading={busy}>
              Create quotation
            </Button>
          </>
        }
      >
        {error ? <p className="mb-3 text-[14px] text-danger">{error}</p> : null}
        <ul className="flex flex-col gap-1">
          {customers.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left transition-colors",
                  selected === c.id ? "border-primary bg-primary-soft" : "border-transparent hover:bg-raised",
                )}
              >
                <span>
                  <span className="block text-[15px] font-medium">{c.company}</span>
                  <span className="block text-[13px] text-muted">
                    {c.name} · {c.city}
                  </span>
                </span>
                <TierPill tier={c.tier} />
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
