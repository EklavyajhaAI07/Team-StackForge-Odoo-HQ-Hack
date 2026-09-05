// All money is stored as integer paise. This is the ONE place that turns it into text.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMoney(
  paise: number,
  opts: { whole?: boolean; signed?: boolean } = {},
): string {
  const rupees = paise / 100;
  const text = opts.whole ? inrWhole.format(Math.abs(rupees)) : inr.format(Math.abs(rupees));
  if (rupees < 0) return `−${text}`;
  if (opts.signed && rupees > 0) return `+${text}`;
  return text;
}

/** Compact form for KPI tiles: ₹12.4L, ₹3.2Cr */
export function formatMoneyCompact(paise: number): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "−" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatPts(value: number, digits = 1): string {
  return `${value.toFixed(digits)} pts`;
}

/** Round a float amount of paise to an integer (half away from zero). */
export function roundPaise(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Net unit price in paise after a percentage discount. */
export function netUnitPrice(effectiveList: number, discountPct: number): number {
  return effectiveList * (1 - discountPct / 100);
}
