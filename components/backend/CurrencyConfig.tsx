"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { BASE_CURRENCY, displayCurrency, formatMoney } from "@/lib/money";
import { SaveBar } from "./SaveBar";

type CurrencyRow = {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  minorUnits: number;
  rateFromBase: number;
  isBase: boolean;
};

type CustomerRow = { id: string; company: string; tier: string; currencyCode: string; quotationCount: number };

/** One rupee shown in each currency, so a wrong rate is obvious rather than arithmetic. */
const SAMPLE_PAISE = 1_00_000_00; // ₹1,00,000

export function CurrencyConfig({
  currencies,
  customers,
  canEdit,
}: {
  currencies: CurrencyRow[];
  customers: CustomerRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rates, setRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(currencies.map((c) => [c.code, String(c.rateFromBase)])),
  );
  const [assigned, setAssigned] = useState<Record<string, string>>(() =>
    Object.fromEntries(customers.map((c) => [c.id, c.currencyCode])),
  );
  const [busy, setBusy] = useState(false);

  const base = currencies.find((c) => c.isBase) ?? null;

  const changedRates = useMemo(
    () => currencies.filter((c) => !c.isBase && Number(rates[c.code]) !== c.rateFromBase),
    [currencies, rates],
  );
  const changedAssignments = useMemo(
    () => customers.filter((c) => assigned[c.id] !== c.currencyCode),
    [customers, assigned],
  );
  const invalid = currencies.some((c) => {
    const v = Number(rates[c.code]);
    return rates[c.code] === "" || Number.isNaN(v) || v <= 0;
  });
  const dirty = changedRates.length > 0 || changedAssignments.length > 0;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/config/currencies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rates: changedRates.map((c) => ({ code: c.code, rateFromBase: Number(rates[c.code]) })),
          assignments: changedAssignments.map((c) => ({ customerId: c.id, currencyCode: assigned[c.id] })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: data.error ?? "Could not save the currencies", tone: "danger" });
        return;
      }
      toast({
        title: "Currencies saved",
        description: "Quotations already created keep the rate they captured.",
        tone: "money",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SaveBar
          title="Currencies and rates"
          description={`Every amount is held in ${BASE_CURRENCY.code} and presented at these rates. A quotation captures its rate when it is created, so changing one here never reprices a quotation already sent.`}
          dirty={dirty}
          busy={busy}
          disabled={invalid || !canEdit}
          onSave={save}
          label="Save currencies"
        />
        <div className="overflow-x-auto px-5 pb-5">
          <table className="table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>Code</th>
                <th className="num">Decimals</th>
                <th className="num">Per {base?.symbol ?? "₹"}1</th>
                <th className="num">{formatMoney(SAMPLE_PAISE, { whole: true })} shows as</th>
                <th className="num">Customers</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => {
                const rate = Number(rates[c.code]);
                const preview = Number.isFinite(rate) && rate > 0 ? displayCurrency({ ...c, rateFromBase: rate }) : null;
                const users = customers.filter((cu) => assigned[cu.id] === c.code).length;
                return (
                  <tr key={c.code}>
                    <td className="font-medium">
                      {c.name}
                      {c.isBase ? (
                        <Pill tone="money" className="ml-2">
                          Base
                        </Pill>
                      ) : null}
                    </td>
                    <td className="num text-muted">{c.code}</td>
                    <td className="num text-muted">{c.minorUnits}</td>
                    <td className="num">
                      <Input
                        numeric
                        dense
                        type="number"
                        min={0}
                        step="any"
                        // The base currency is the unit, so its own rate is not a number anyone sets.
                        disabled={!canEdit || c.isBase}
                        className="w-28"
                        value={rates[c.code] ?? ""}
                        onChange={(e) => setRates((r) => ({ ...r, [c.code]: e.target.value }))}
                        aria-label={`${c.code} per one ${base?.code ?? "INR"}`}
                      />
                    </td>
                    <td className="num">{preview ? formatMoney(SAMPLE_PAISE, { whole: true, currency: preview }) : "—"}</td>
                    <td className={users > 0 ? "num" : "num text-faint"}>{users}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="px-5 pt-4 pb-2">
          <h2>What each customer is quoted in</h2>
          <p className="text-[13px] text-muted">
            Changing this affects the next quotation for that customer. Existing quotations keep the currency and rate
            they were created with.
          </p>
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Tier</th>
                <th className="num">Quotations</th>
                <th>Quoted in</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.company}</td>
                  <td className="text-muted">{c.tier}</td>
                  <td className="num text-muted">{c.quotationCount}</td>
                  <td>
                    <div className="w-40">
                    <Select
                      dense
                      disabled={!canEdit}
                      className="w-full"
                      value={assigned[c.id] ?? BASE_CURRENCY.code}
                      onChange={(e) => setAssigned((a) => ({ ...a, [c.id]: e.target.value }))}
                      aria-label={`Currency for ${c.company}`}
                    >
                      {currencies.map((cur) => (
                        <option key={cur.code} value={cur.code}>
                          {cur.code} · {cur.name}
                        </option>
                      ))}
                    </Select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
