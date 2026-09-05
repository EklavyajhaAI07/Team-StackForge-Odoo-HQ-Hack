import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

export type AuditActor =
  | { type: "USER"; id: string }
  | { type: "CUSTOMER"; id: string }
  | { type: "SYSTEM"; id?: undefined };

export type AuditInput = {
  entityType: "Quotation" | "Order" | "Invoice" | "Config" | "Product" | "Warehouse";
  entityId: string;
  actor: AuditActor;
  action: string;
  reason?: string | null;
  meta?: Prisma.InputJsonValue;
};

/**
 * Writes one AuditEvent (who, when, what, why). When the entity is a Quotation
 * (or a quotationId is supplied in meta) its lastActivityAt is touched — §5.6.
 */
export async function logAudit(db: Tx | typeof prisma, input: AuditInput, quotationId?: string) {
  const meta: Record<string, unknown> = {};
  if (input.meta && typeof input.meta === "object" && !Array.isArray(input.meta)) {
    Object.assign(meta, input.meta as Record<string, unknown>);
  }
  if (input.reason) meta.reason = input.reason;

  const event = await db.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      action: input.action,
      meta: Object.keys(meta).length ? (meta as Prisma.InputJsonValue) : undefined,
    },
  });

  const touchId = quotationId ?? (input.entityType === "Quotation" ? input.entityId : undefined);
  if (touchId) {
    await db.quotation.update({
      where: { id: touchId },
      data: { lastActivityAt: new Date() },
    });
  }
  return event;
}
