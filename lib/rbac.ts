import type { Role } from "@prisma/client";

export type Action =
  | "quotation:view"
  | "quotations:all"
  | "quotation:create"
  | "quotation:edit"
  | "quotation:send"
  | "quotation:confirm"
  | "approval:manager"
  | "approval:finance"
  | "fulfillment:decide"
  | "billing:manage"
  | "config:discounts"
  | "config:all"
  | "dashboard:view"
  | "reports:view"
  | "reports:all"
  | "users:view"
  | "nudge";

export type Actor = { id: string; role: Role };

/** Resource ownership context. `repId` is the quotation owner. */
export type Resource = { repId?: string | null } | null | undefined;

const ROLE_ACTIONS: Record<Role, Set<Action>> = {
  SALES_REP: new Set<Action>([
    "quotation:view",
    "quotation:create",
    "quotation:edit",
    "quotation:send",
    "quotation:confirm",
    "reports:view",
  ]),
  SALES_MANAGER: new Set<Action>([
    "quotation:view",
    "quotations:all",
    "quotation:create",
    "quotation:edit",
    "quotation:send",
    "quotation:confirm",
    "approval:manager",
    "config:discounts",
    "dashboard:view",
    "reports:view",
    "reports:all",
    "nudge",
  ]),
  FINANCE: new Set<Action>([
    "quotation:view",
    "quotations:all",
    "approval:finance",
    "fulfillment:decide",
    "billing:manage",
    "reports:view",
    "reports:all",
    "dashboard:view",
  ]),
  ADMIN: new Set<Action>([
    "quotation:view",
    "quotations:all",
    "quotation:create",
    "quotation:edit",
    "quotation:send",
    "quotation:confirm",
    "approval:manager",
    "approval:finance",
    "fulfillment:decide",
    "billing:manage",
    "config:discounts",
    "config:all",
    "dashboard:view",
    "reports:view",
    "reports:all",
    "users:view",
    "nudge",
  ]),
};

/** Actions where a SALES_REP is restricted to quotations they own. */
const OWNER_SCOPED: Set<Action> = new Set([
  "quotation:edit",
  "quotation:send",
  "quotation:confirm",
]);

/**
 * The single RBAC gate. Every route handler calls this.
 *   can(user, "approval:manager")                → role check
 *   can(user, "quotation:edit", { repId })       → role check + ownership for reps
 */
export function can(actor: Actor, action: Action, resource?: Resource): boolean {
  const allowed = ROLE_ACTIONS[actor.role];
  if (!allowed?.has(action)) return false;
  if (actor.role === "SALES_REP" && OWNER_SCOPED.has(action)) {
    if (!resource || !resource.repId) return false;
    return resource.repId === actor.id;
  }
  return true;
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "SALES_REP":
      return "Sales rep";
    case "SALES_MANAGER":
      return "Sales manager";
    case "FINANCE":
      return "Finance";
    case "ADMIN":
      return "Admin";
  }
}
