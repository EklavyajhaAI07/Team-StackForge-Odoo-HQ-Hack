// §5.2 Approval routing — pure. Thresholds come from ApprovalConfig, never literals.

export type RoutingConfig = {
  managerBlendedMaxPts: number;
  financeLineOveragePts: number;
  financeAmountThreshold: number; // paise
};

export type RoutingInput = {
  blended: number;
  maxLineOverage: number;
  /** Order total in paise (net of discounts, excl. tax). */
  total: number;
};

export type ApprovalRole = "SALES_MANAGER" | "FINANCE";

export type RoutingDecision =
  | { kind: "AUTO_APPROVED"; steps: []; initialStatus: "APPROVED"; reason: string }
  | {
      kind: "MANAGER";
      steps: ["SALES_MANAGER"];
      initialStatus: "PENDING_MANAGER";
      reason: string;
    }
  | {
      kind: "MANAGER_FINANCE";
      steps: ["SALES_MANAGER", "FINANCE"];
      initialStatus: "PENDING_MANAGER";
      reason: string;
    };

export function routeQuotation(input: RoutingInput, config: RoutingConfig): RoutingDecision {
  const { blended, maxLineOverage, total } = input;

  if (blended === 0 && maxLineOverage === 0) {
    return {
      kind: "AUTO_APPROVED",
      steps: [],
      initialStatus: "APPROVED",
      reason: "auto-approved: within policy",
    };
  }

  const managerOnly =
    blended <= config.managerBlendedMaxPts &&
    maxLineOverage <= config.financeLineOveragePts &&
    total < config.financeAmountThreshold;

  if (managerOnly) {
    return {
      kind: "MANAGER",
      steps: ["SALES_MANAGER"],
      initialStatus: "PENDING_MANAGER",
      reason: `blended ${blended.toFixed(1)} pts ≤ ${config.managerBlendedMaxPts} and max line overage ${maxLineOverage.toFixed(1)} pts ≤ ${config.financeLineOveragePts}`,
    };
  }

  const why: string[] = [];
  if (blended > config.managerBlendedMaxPts)
    why.push(`blended ${blended.toFixed(1)} pts > ${config.managerBlendedMaxPts}`);
  if (maxLineOverage > config.financeLineOveragePts)
    why.push(`a line is ${maxLineOverage.toFixed(1)} pts over (> ${config.financeLineOveragePts})`);
  if (total >= config.financeAmountThreshold) why.push(`order total ≥ finance threshold`);

  return {
    kind: "MANAGER_FINANCE",
    steps: ["SALES_MANAGER", "FINANCE"],
    initialStatus: "PENDING_MANAGER",
    reason: why.join("; "),
  };
}

/** Human labels for the step list. */
export function stepLabel(role: ApprovalRole): string {
  return role === "SALES_MANAGER" ? "Sales manager" : "Finance";
}
