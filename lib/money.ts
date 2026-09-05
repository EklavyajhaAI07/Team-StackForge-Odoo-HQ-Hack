// All money is STORED as integer minor units of the base currency (paise). This is the ONE
// place that turns it into text, and the one place that converts it for presentation.
//
// Why store one currency: every engine — risk, routing, split, proration — compares and sums
// amounts. Mixing currencies inside that maths is how rounding bugs and wrong approvals happen.
// So the ledger is single-currency and conversion is a display concern, applied at the edge
// against a rate the quotation snapshotted when it was created.

export type DisplayCurrency = {
  code: string;
  symbol: string;
  locale: string;
  minorUnits: number;
  /** Units of this currency per 1 unit of the base currency. The base itself is 1. */
  rate: number;
};

/** The ledger currency. Everything in the database is in this currency's minor units. */
export const BASE_CURRENCY: DisplayCurrency = {
  code: "INR",
  symbol: "₹",
  locale: "en-IN",
  minorUnits: 2,
  rate: 1,
};

/** Narrow a Currency row (or a quotation's snapshot) down to what formatting needs. */
export function displayCurrency(
  currency: { code: string; symbol: string; locale: string; minorUnits: number; rateFromBase: number } | null | undefined,
  fxRate?: number,
): DisplayCurrency {
  if (!currency) return BASE_CURRENCY;
  return {
    code: currency.code,
    symbol: currency.symbol,
    locale: currency.locale,
    minorUnits: currency.minorUnits,
    // The quotation's snapshotted rate wins over the currency's current one.
    rate: fxRate ?? currency.rateFromBase,
  };
}

// Intl formatters are expensive to construct, and a report can format thousands of cells.
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: DisplayCurrency, whole: boolean): Intl.NumberFormat {
  const key = `${currency.locale}|${currency.code}|${whole}|${currency.minorUnits}`;
  let f = formatters.get(key);
  if (!f) {
    const digits = whole ? 0 : currency.minorUnits;
    f = new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formatters.set(key, f);
  }
  return f;
}

/** Base minor units → the presentation currency's major unit. */
function toMajor(baseMinor: number, currency: DisplayCurrency): number {
  return (baseMinor / 10 ** BASE_CURRENCY.minorUnits) * currency.rate;
}

export function formatMoney(
  paise: number,
  opts: { whole?: boolean; signed?: boolean; currency?: DisplayCurrency } = {},
): string {
  const currency = opts.currency ?? BASE_CURRENCY;
  const amount = toMajor(paise, currency);
  const text = formatter(currency, opts.whole ?? false).format(Math.abs(amount));
  if (amount < 0) return `−${text}`;
  if (opts.signed && amount > 0) return `+${text}`;
  return text;
}

/**
 * Compact form for KPI tiles. Indian numbering groups in lakh and crore, so a rupee figure
 * reads ₹12.4L where a dollar figure has to read $12.4K — the same number, grouped the way
 * each audience actually reads it.
 */
export function formatMoneyCompact(paise: number, currency: DisplayCurrency = BASE_CURRENCY): string {
  const amount = toMajor(paise, currency);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const s = currency.symbol;

  if (currency.locale.endsWith("-IN")) {
    if (abs >= 1_00_00_000) return `${sign}${s}${(abs / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `${sign}${s}${(abs / 1_00_000).toFixed(1)}L`;
    if (abs >= 1_000) return `${sign}${s}${(abs / 1_000).toFixed(1)}k`;
    return `${sign}${s}${abs.toFixed(0)}`;
  }

  if (abs >= 1_000_000_000) return `${sign}${s}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${s}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${s}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${s}${abs.toFixed(0)}`;
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
