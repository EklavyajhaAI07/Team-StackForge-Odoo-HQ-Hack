"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconCopy } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

/**
 * The customer's link, wherever you happen to be standing.
 *
 * Minting a link stays on the builder rail and stays gated on approval — a customer must
 * never be shown pricing nobody has signed off. But once a link exists, needing it is not
 * confined to one screen: finance on the billing tab wants to re-send it as readily as the
 * rep who created it. So this only ever copies a link that has already been issued.
 */
export function PortalLinkButton({ url }: { url: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Portal link copied", description: "Open it in a private window to see it as the customer.", tone: "info" });
    } catch {
      // Clipboard access can be refused; showing the link still lets someone copy it by hand.
      toast({ title: "Could not copy", description: url, tone: "warn", durationMs: 12000 });
    }
  }

  return (
    <Button size="sm" variant="secondary" icon={<IconCopy size={13} />} onClick={copy}>
      {copied ? "Copied" : "Copy portal link"}
    </Button>
  );
}
