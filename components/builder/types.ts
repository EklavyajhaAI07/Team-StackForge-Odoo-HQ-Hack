export type VariantOpt = { id: string; value: string; extraPrice: number };
export type PlanOpt = { id: string; name: string; interval: string; cancelRule: string };

export type CatalogItem = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  kind: "ONE_TIME" | "RECURRING";
  unit: string;
  listPrice: number;
  tierPrice: number | null;
  cost: number;
  taxPct: number;
  isPromoted: boolean;
  attributeName: string | null;
  variants: VariantOpt[];
  description: string;
};

export type BuilderLine = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  categoryName: string;
  unit: string;
  isRecurring: boolean;
  variantId: string | null;
  variantValue: string | null;
  planId: string | null;
  planName: string | null;
  qty: number;
  unitPrice: number;
  discountPct: number;
  cost: number;
  taxPct: number;
  ceilingPct: number;
  variants: VariantOpt[];
};

export type BuilderConfig = {
  managerBlendedMaxPts: number;
  financeLineOveragePts: number;
  financeAmountThreshold: number;
};

export type UpsellItem = {
  productId: string;
  name: string;
  isPromoted: boolean;
  coCount: number;
  marginDelta: number;
  marginPct: number;
  because: string[];
};

export type BuilderQuotation = {
  id: string;
  number: string;
  status: string;
  repId: string;
  customerCompany: string;
  customerTier: string;
};

export type BuilderPermissions = {
  canEdit: boolean; // lines are editable right now
  canSubmit: boolean; // may submit / send / confirm
  canRevise: boolean;
};
