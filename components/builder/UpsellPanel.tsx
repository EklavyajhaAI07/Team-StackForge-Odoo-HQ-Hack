"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { IconSparkle } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import type { CatalogItem, UpsellItem } from "./types";

export function UpsellPanel({
  items,
  catalog,
  canAdd,
  onAdd,
}: {
  items: UpsellItem[];
  catalog: CatalogItem[];
  canAdd: boolean;
  onAdd: (item: CatalogItem) => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const visible = items.filter((i) => !dismissed.has(i.productId));

  return (
    <Card>
      <div className="flex items-center gap-2 px-5 pt-4">
        <IconSparkle size={15} className="text-primary" />
        <h3>Suggested add-ons</h3>
      </div>
      <p className="px-5 pt-0.5 text-[13px] text-muted">Learned from order history — ranked by co-purchase count, promoted items weighted 1.5×.</p>
      <div className="px-5 pb-5 pt-3">
        {visible.length === 0 ? (
          <p className="text-[14px] text-muted">{items.length === 0 ? "Add a line to see what usually goes with it." : "Nothing left to suggest."}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((u) => {
              const item = catalog.find((c) => c.id === u.productId);
              return (
                <li key={u.productId} className="rounded-[8px] border border-border bg-bg/40 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{u.name}</span>
                        {u.isPromoted ? <Pill tone="primary">Promoted</Pill> : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-muted">
                        Bought together {u.coCount}× {u.because.length ? `with ${u.because.join(" and ")}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="num text-[14px] text-money">+{formatMoney(u.marginDelta, { whole: true })}</div>
                      <div className="text-[11px] text-muted">margin per unit</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!canAdd || !item}
                      loading={busy === u.productId}
                      onClick={async () => {
                        if (!item) return;
                        setBusy(u.productId);
                        try {
                          await onAdd(item);
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      Add to quote
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDismissed((s) => new Set(s).add(u.productId))}>
                      Dismiss
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
