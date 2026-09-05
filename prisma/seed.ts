/* eslint-disable no-console */
// DealFlow360 seed — §7. Realism is a judging feature: believable margins, a rep who discounts
// too much, co-purchase patterns the upsell engine can learn, and a pipeline that is alive at login.
import { PrismaClient, type Prisma, type Tier } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { computeRisk, effectiveListPrice, type RiskLineInput } from "../lib/engine/risk";
import { buildSchedule } from "../lib/engine/proration";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../lib/demo-accounts";
import { lineNet, quotationTotals } from "../lib/quotes";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const now = new Date();
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * 3_600_000);
const R = (rupees: number) => Math.round(rupees * 100); // rupees → paise

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(360);
const gauss = () => {
  // Box–Muller
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

async function wipe() {
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billingEntry.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.backorder.deleteMany();
  await prisma.order.deleteMany();
  await prisma.portalMessage.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.portalToken.deleteMany();
  await prisma.quotationLine.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.historicalOrder.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.discountPolicy.deleteMany();
  await prisma.category.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.approvalConfig.deleteMany();
}

async function main() {
  console.log("Seeding DealFlow360…");
  await wipe();

  // ── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, { id: string; name: string }> = {};
  for (const a of DEMO_ACCOUNTS) {
    const u = await prisma.user.create({ data: { name: a.name, email: a.email, role: a.role, passwordHash } });
    users[a.email] = u;
  }
  const priya = users["priya@dealflow.local"];
  const arjun = users["arjun@dealflow.local"];
  const meera = users["meera@dealflow.local"];
  const vikram = users["vikram@dealflow.local"];

  // ── Customers ────────────────────────────────────────────────────────────
  const customersData = [
    { company: "Acme Industries", name: "Rohit Kulkarni", email: "rohit@acmeindustries.in", tier: "GOLD", city: "Pune" },
    { company: "Beta Traders", name: "Sunita Agarwal", email: "sunita@betatraders.in", tier: "SILVER", city: "Surat" },
    { company: "Nimbus Retail", name: "Karan Bhatia", email: "karan@nimbusretail.in", tier: "BRONZE", city: "Jaipur" },
    { company: "Orion Labs", name: "Dr. Neha Joshi", email: "neha@orionlabs.in", tier: "GOLD", city: "Hyderabad" },
    { company: "Zenith Corp", name: "Farhan Sheikh", email: "farhan@zenithcorp.in", tier: "SILVER", city: "Mumbai" },
  ] as const;
  const customers: Record<string, { id: string; tier: Tier; company: string }> = {};
  for (const c of customersData) {
    const row = await prisma.customer.create({ data: { ...c } });
    customers[c.company] = row;
  }
  const acme = customers["Acme Industries"];
  const beta = customers["Beta Traders"];
  const nimbus = customers["Nimbus Retail"];
  const orion = customers["Orion Labs"];
  const zenith = customers["Zenith Corp"];

  // ── Categories & discount policy matrix ───────────────────────────────────
  const hardware = await prisma.category.create({ data: { name: "Hardware" } });
  const services = await prisma.category.create({ data: { name: "Services" } });
  const subs = await prisma.category.create({ data: { name: "Subscriptions" } });

  // Bronze 5/3/5 · Silver 10/7/10 · Gold 15/10/12 (Hardware/Services/Subscriptions) — services strictest
  const policy: Record<Tier, Record<string, number>> = {
    BRONZE: { [hardware.id]: 5, [services.id]: 3, [subs.id]: 5 },
    SILVER: { [hardware.id]: 10, [services.id]: 7, [subs.id]: 10 },
    GOLD: { [hardware.id]: 15, [services.id]: 10, [subs.id]: 12 },
  };
  for (const tier of ["BRONZE", "SILVER", "GOLD"] as Tier[]) {
    for (const [categoryId, ceilingPct] of Object.entries(policy[tier])) {
      await prisma.discountPolicy.create({ data: { tier, categoryId, ceilingPct } });
    }
  }

  await prisma.approvalConfig.create({ data: { id: 1 } }); // §4 defaults: 3 pts / 5 pts / ₹5,00,000 / 3 days / 2σ

  // ── Plans ─────────────────────────────────────────────────────────────────
  const planMonthly = await prisma.subscriptionPlan.create({ data: { name: "Monthly", interval: "MONTHLY", cancelRule: "PRORATED_CREDIT" } });
  const planQuarterly = await prisma.subscriptionPlan.create({ data: { name: "Quarterly", interval: "QUARTERLY", cancelRule: "PRORATED_CREDIT" } });
  const planYearly = await prisma.subscriptionPlan.create({ data: { name: "Yearly", interval: "YEARLY", cancelRule: "PRORATED_CREDIT" } });
  const planMonthlyNoRefund = await prisma.subscriptionPlan.create({ data: { name: "Monthly (no refund)", interval: "MONTHLY", cancelRule: "NO_REFUND" } });

  // ── Products (24) ─────────────────────────────────────────────────────────
  type P = {
    sku: string;
    name: string;
    cat: string;
    kind: "ONE_TIME" | "RECURRING";
    unit: string;
    cost: number;
    list: number;
    tax?: number;
    desc: string;
    promoted?: boolean;
    attr?: string;
    variants?: { value: string; extra: number }[];
  };
  const H = hardware.id;
  const S = services.id;
  const U = subs.id;
  const catalog: P[] = [
    // Hardware — margin ≈ 35%
    { sku: "HW-LAP-14", name: "ProBook 14 Business Laptop", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(40300), list: R(62000), desc: "14-inch, 16 GB RAM, 512 GB SSD, 3-year onsite warranty eligible.", promoted: true },
    { sku: "HW-SCL-150", name: "Industrial Weighing Scale 150 kg", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(12000), list: R(18500), desc: "Stainless platform, RS-232 output, legal-for-trade class III." },
    { sku: "HW-PRN-TL", name: "Thermal Label Printer", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(6400), list: R(9800), desc: "203 dpi direct-thermal, USB + Ethernet." },
    { sku: "HW-SCN-2D", name: "Barcode Scanner (2D)", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(2700), list: R(4200), desc: "Handheld 2D imager, USB.", attr: "Pack", variants: [{ value: "Single", extra: 0 }, { value: "Pack of 5", extra: R(15960) }] },
    { sku: "HW-TAB-10", name: "Rugged Tablet 10\"", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(22100), list: R(34000), desc: "IP67, glove-touch, 12-hour battery.", promoted: true },
    { sku: "HW-SW-24", name: "Network Switch 24-port", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(10100), list: R(15500), desc: "Managed gigabit switch, 4 × SFP." },
    { sku: "HW-UPS-1K", name: "UPS 1 kVA", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(5800), list: R(8900), desc: "Line-interactive, 20 min runtime at half load." },
    { sku: "HW-PPR-A4", name: "A4 Copier Paper (500 sheets)", cat: H, kind: "ONE_TIME", unit: "ream", cost: R(210), list: R(320), tax: 12, desc: "75 gsm, bright white.", attr: "Pack", variants: [{ value: "Single ream", extra: 0 }, { value: "Box of 10", extra: R(2880) }] },
    { sku: "HW-CHR-ERG", name: "Ergonomic Office Chair", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(8100), list: R(12500), desc: "Mesh back, adjustable lumbar, 5-year frame warranty." },
    { sku: "HW-MON-27", name: "27\" Monitor", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(10900), list: R(16800), desc: "QHD IPS, USB-C 65 W, height-adjustable." },
    { sku: "HW-WAP", name: "Wireless Access Point", cat: H, kind: "ONE_TIME", unit: "unit", cost: R(4700), list: R(7200), desc: "Wi-Fi 6, PoE powered, ceiling mount." },
    // Services — margin ≈ 55%
    { sku: "SV-SETUP", name: "On-site Setup Service", cat: S, kind: "ONE_TIME", unit: "visit", cost: R(2700), list: R(6000), desc: "Unboxing, imaging, domain join and hand-over per device batch.", promoted: true },
    { sku: "SV-WAR-2Y", name: "Extended Warranty (2 years)", cat: S, kind: "ONE_TIME", unit: "unit", cost: R(2400), list: R(5500), desc: "Adds 2 years of next-business-day onsite support.", promoted: true },
    { sku: "SV-CAL", name: "Scale Calibration Service", cat: S, kind: "ONE_TIME", unit: "visit", cost: R(1400), list: R(3200), desc: "NABL-traceable calibration with certificate." },
    { sku: "SV-NET-INST", name: "Network Installation", cat: S, kind: "ONE_TIME", unit: "job", cost: R(6800), list: R(15000), desc: "Rack, patch and configure up to 48 ports." },
    { sku: "SV-TRAIN", name: "Staff Training Workshop", cat: S, kind: "ONE_TIME", unit: "session", cost: R(5400), list: R(12000), desc: "Half-day onsite session for up to 20 people." },
    { sku: "SV-AMC", name: "Annual Maintenance Contract", cat: S, kind: "ONE_TIME", unit: "year", cost: R(8000), list: R(18000), desc: "Quarterly preventive visits plus priority breakdown response." },
    { sku: "SV-DATA-MIG", name: "Data Migration", cat: S, kind: "ONE_TIME", unit: "job", cost: R(11000), list: R(25000), desc: "Migrate legacy records with validation report." },
    { sku: "SV-RPT", name: "Custom Report Development", cat: S, kind: "ONE_TIME", unit: "job", cost: R(9000), list: R(20000), desc: "Up to five bespoke reports with sign-off." },
    { sku: "SV-RSH", name: "Remote Support Hours (10-pack)", cat: S, kind: "ONE_TIME", unit: "pack", cost: R(3600), list: R(8000), desc: "Ten hours of remote engineering support, valid 12 months." },
    // Subscriptions — margin ≈ 70%
    { sku: "SB-CLOUD-STD", name: "DealFlow Cloud Standard (per seat, monthly)", cat: U, kind: "RECURRING", unit: "seat", cost: R(360), list: R(1200), desc: "Core CRM + quoting, 20 GB storage per seat.", promoted: true },
    { sku: "SB-CLOUD-ENT", name: "DealFlow Cloud Enterprise (per seat, yearly)", cat: U, kind: "RECURRING", unit: "seat", cost: R(4200), list: R(14000), desc: "SSO, audit export, 99.9% SLA.", promoted: true },
    { sku: "SB-MDM-Q", name: "Device Management (per device, quarterly)", cat: U, kind: "RECURRING", unit: "device", cost: R(720), list: R(2400), desc: "Remote lock, wipe and app policy for field devices." },
    { sku: "SB-SUP-M", name: "Priority Support (monthly, no refund)", cat: U, kind: "RECURRING", unit: "month", cost: R(1050), list: R(3500), desc: "4-hour response, dedicated engineer, no mid-term refunds." },
  ];

  const products: Record<string, { id: string; name: string; cost: number; listPrice: number; taxPct: number; categoryId: string; isPromoted: boolean }> = {};
  const variants: Record<string, { id: string; extraPrice: number }> = {};
  for (const p of catalog) {
    const row = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        categoryId: p.cat,
        kind: p.kind,
        unit: p.unit,
        cost: p.cost,
        listPrice: p.list,
        taxPct: p.tax ?? 18,
        description: p.desc,
        isPromoted: p.promoted ?? false,
        attributeName: p.attr ?? null,
      },
    });
    products[p.sku] = row;
    for (const v of p.variants ?? []) {
      const vr = await prisma.productVariant.create({ data: { productId: row.id, value: v.value, extraPrice: v.extra } });
      variants[`${p.sku}:${v.value}`] = vr;
    }
  }
  const sku = (s: string) => products[s];

  // ── Price list (tier-specific prices; everything else falls back to list) ──
  const priceList: [Tier, string, number][] = [
    ["GOLD", "HW-LAP-14", R(60000)],
    ["GOLD", "HW-TAB-10", R(33000)],
    ["GOLD", "HW-MON-27", R(16200)],
    ["GOLD", "SB-CLOUD-STD", R(1100)],
    ["SILVER", "HW-LAP-14", R(61000)],
    ["SILVER", "SB-CLOUD-STD", R(1150)],
  ];
  const tierPrice = new Map<string, number>();
  for (const [tier, s, price] of priceList) {
    await prisma.priceListItem.create({ data: { tier, productId: sku(s).id, price } });
    tierPrice.set(`${tier}:${sku(s).id}`, price);
  }

  // ── Warehouses & stock ────────────────────────────────────────────────────
  const main = await prisma.warehouse.create({ data: { name: "Main Warehouse", city: "Ahmedabad", shippingCostWeight: R(400) } });
  const east = await prisma.warehouse.create({ data: { name: "East Depot", city: "Kolkata", shippingCostWeight: R(650) } });
  const south = await prisma.warehouse.create({ data: { name: "South Hub", city: "Bengaluru", shippingCostWeight: R(560) } });
  // Laptop ×10 cannot come from one place (forces a 2-warehouse split); Rugged Tablet is short everywhere.
  const stock: [string, number, number, number][] = [
    ["HW-LAP-14", 6, 3, 8],
    ["HW-SCL-150", 12, 4, 0],
    ["HW-PRN-TL", 20, 10, 15],
    ["HW-SCN-2D", 30, 0, 25],
    ["HW-TAB-10", 2, 1, 0],
    ["HW-SW-24", 5, 8, 3],
    ["HW-UPS-1K", 10, 6, 12],
    ["HW-PPR-A4", 200, 150, 90],
    ["HW-CHR-ERG", 15, 0, 20],
    ["HW-MON-27", 9, 12, 4],
    ["HW-WAP", 14, 5, 10],
  ];
  for (const [s, m, e, so] of stock) {
    for (const [wh, qty] of [
      [main, m],
      [east, e],
      [south, so],
    ] as const) {
      await prisma.stock.create({ data: { warehouseId: wh.id, productId: sku(s).id, qty } });
    }
  }

  // ── Historical orders (40, six months) — Priya μ≈6%, Arjun μ≈9% ───────────
  const templates: string[][] = [
    ["HW-LAP-14", "SV-SETUP", "SV-WAR-2Y"],
    ["HW-LAP-14", "SV-SETUP", "SV-WAR-2Y"],
    ["HW-LAP-14", "SV-SETUP"],
    ["HW-LAP-14", "SV-WAR-2Y", "SB-CLOUD-STD"],
    ["HW-LAP-14", "SB-CLOUD-STD", "SV-TRAIN"],
    ["HW-SCL-150", "SV-CAL"],
    ["HW-SCL-150", "SV-CAL", "HW-PRN-TL"],
    ["HW-PRN-TL", "HW-SCN-2D"],
    ["HW-TAB-10", "SB-MDM-Q"],
    ["HW-TAB-10", "SB-MDM-Q", "SV-WAR-2Y"],
    ["HW-SW-24", "HW-WAP", "SV-NET-INST"],
    ["HW-MON-27", "HW-CHR-ERG"],
    ["HW-UPS-1K", "HW-SW-24"],
    ["SB-CLOUD-ENT", "SV-DATA-MIG", "SV-TRAIN"],
  ];
  const customerList = [acme, beta, nimbus, orion, zenith];
  const historyRows: Prisma.HistoricalOrderCreateManyInput[] = [];
  for (let i = 0; i < 40; i++) {
    const isPriya = i < 22;
    const rep = isPriya ? priya : arjun;
    const disc = isPriya ? clamp(6 + gauss() * 1.2, 3, 9) : clamp(9 + gauss() * 1.5, 5.5, 12.5);
    const skus = pick(templates);
    const qty = 1 + Math.floor(rand() * 8);
    const gross = skus.reduce((s, k) => s + sku(k).listPrice * qty, 0);
    historyRows.push({
      repId: rep.id,
      customerId: pick(customerList).id,
      orderDiscountPct: Math.round(disc * 10) / 10,
      total: Math.round(gross * (1 - disc / 100)),
      productIds: skus.map((k) => sku(k).id),
      createdAt: ago(Math.floor(rand() * 180) + 3),
    });
  }
  await prisma.historicalOrder.createMany({ data: historyRows });

  // ── Quotations ────────────────────────────────────────────────────────────
  type LineSpec = { sku: string; qty: number; disc: number; variant?: string; plan?: { id: string } };
  const effList = (tier: Tier, s: string, variant?: string) =>
    effectiveListPrice({
      listPrice: sku(s).listPrice,
      tierPrice: tierPrice.get(`${tier}:${sku(s).id}`) ?? null,
      variantExtra: variant ? variants[`${s}:${variant}`].extraPrice : 0,
    });

  async function audit(entityType: string, entityId: string, actor: { type: string; id?: string }, action: string, at: Date, meta?: Prisma.InputJsonValue) {
    await prisma.auditEvent.create({ data: { entityType, entityId, actorType: actor.type, actorId: actor.id ?? null, action, meta, createdAt: at } });
  }

  async function createQuotation(input: {
    number: string;
    customer: { id: string; tier: Tier };
    rep: { id: string };
    status: "DRAFT" | "PENDING_MANAGER" | "PENDING_FINANCE" | "APPROVED" | "SENT" | "UNDER_NEGOTIATION" | "CONFIRMED" | "REJECTED";
    createdAt: Date;
    lastActivityAt: Date;
    lines: LineSpec[];
  }) {
    const riskInputs: RiskLineInput[] = [];
    const lineData: Prisma.QuotationLineCreateWithoutQuotationInput[] = [];
    for (const l of input.lines) {
      const p = sku(l.sku);
      const unitPrice = effList(input.customer.tier, l.sku, l.variant);
      riskInputs.push({ lineId: l.sku, qty: l.qty, discountPct: l.disc, effectiveList: unitPrice, cost: p.cost, ceilingPct: policy[input.customer.tier][p.categoryId] });
      lineData.push({
        product: { connect: { id: p.id } },
        variant: l.variant ? { connect: { id: variants[`${l.sku}:${l.variant}`].id } } : undefined,
        plan: l.plan ? { connect: { id: l.plan.id } } : undefined,
        qty: l.qty,
        unitPrice,
        discountPct: l.disc,
        isRecurring: !!l.plan,
      });
    }
    const risk = computeRisk(riskInputs);
    const q = await prisma.quotation.create({
      data: {
        number: input.number,
        customerId: input.customer.id,
        repId: input.rep.id,
        status: input.status,
        blendedRiskScore: risk.blended,
        maxLineOverage: risk.maxLineOverage,
        promisedDate: new Date(input.createdAt.getTime() + 14 * DAY),
        createdAt: input.createdAt,
        lastActivityAt: input.lastActivityAt,
        lines: { create: lineData },
      },
      include: { lines: { include: { product: true } } },
    });
    return { q, risk };
  }

  const mkToken = async (customerId: string, quotationId: string, issuedAt: Date) => {
    const token = randomBytes(24).toString("base64url");
    return prisma.portalToken.create({
      data: { token, customerId, quotationId, expiresAt: new Date(issuedAt.getTime() + 72 * 3_600_000), usedAt: null },
    });
  };
  const U_ = (id: string) => ({ type: "USER", id });
  const SYS = { type: "SYSTEM" };

  // Q1 — Acme (GOLD) · Priya · CONFIRMED, order not yet fulfilled → the 2-warehouse split demo
  {
    const t0 = ago(12);
    const { q } = await createQuotation({
      number: "Q-2026-0101",
      customer: acme,
      rep: priya,
      status: "CONFIRMED",
      createdAt: t0,
      lastActivityAt: ago(2),
      lines: [
        { sku: "HW-LAP-14", qty: 10, disc: 12 },
        { sku: "SV-SETUP", qty: 10, disc: 8 },
        { sku: "SB-CLOUD-STD", qty: 10, disc: 10, plan: planMonthly },
      ],
    });
    await audit("Quotation", q.id, U_(priya.id), "created", t0, { customer: "Acme Industries" });
    await audit("Quotation", q.id, U_(priya.id), "line-added", new Date(t0.getTime() + 5 * 60_000), { product: "ProBook 14 Business Laptop", qty: 10 });
    await audit("Quotation", q.id, SYS, "auto-approved: within policy", ago(11), { blended: 0, maxLineOverage: 0 });
    await audit("Quotation", q.id, U_(priya.id), "sent-to-customer", ago(10));
    const confirmedAt = ago(2);
    await audit("Quotation", q.id, { type: "CUSTOMER", id: acme.id }, "confirmed", confirmedAt, { via: "portal" });
    const order = await prisma.order.create({
      data: { quotationId: q.id, status: "CONFIRMED", promisedDate: new Date(confirmedAt.getTime() + 5 * DAY) },
    });
    const oneTime = q.lines.filter((l) => !l.isRecurring);
    const totals = quotationTotals(oneTime);
    await prisma.invoice.create({
      data: { orderId: order.id, kind: "ONE_TIME", amount: totals.net, tax: totals.tax, status: "POSTED", dueDate: new Date(confirmedAt.getTime() + 30 * DAY) },
    });
    for (const l of q.lines.filter((l) => l.isRecurring)) {
      const sched = buildSchedule({ anchor: confirmedAt, interval: "MONTHLY", cycles: 3, amountPerCycle: lineNet(l) });
      for (const s of sched) {
        await prisma.billingEntry.create({ data: { orderId: order.id, lineId: l.id, billOn: s.billOn, amount: s.amount, status: "SCHEDULED" } });
      }
    }
    await audit("Order", order.id, SYS, "order-created", confirmedAt, { quotation: q.number, oneTimeInvoice: totals.net, recurringCycles: 3 });
    const portalTok = await mkToken(acme.id, q.id, ago(10));
    await prisma.portalToken.update({ where: { id: portalTok.id }, data: { usedAt: ago(9) } });
  }

  // Q2 — Beta (SILVER) · Arjun · PENDING_FINANCE (manager already approved) — big overages
  {
    const t0 = ago(3);
    const { q, risk } = await createQuotation({
      number: "Q-2026-0102",
      customer: beta,
      rep: arjun,
      status: "PENDING_FINANCE",
      createdAt: t0,
      lastActivityAt: ago(1),
      lines: [
        { sku: "HW-TAB-10", qty: 5, disc: 18 },
        { sku: "SV-NET-INST", qty: 1, disc: 15 },
        { sku: "SB-MDM-Q", qty: 5, disc: 10, plan: planQuarterly },
      ],
    });
    await prisma.approval.create({ data: { quotationId: q.id, step: 1, role: "SALES_MANAGER", status: "APPROVED", approverId: meera.id, reason: "Strategic account — regional head signed off on the tablet pricing", actedAt: ago(1) } });
    await prisma.approval.create({ data: { quotationId: q.id, step: 2, role: "FINANCE", status: "PENDING" } });
    await audit("Quotation", q.id, U_(arjun.id), "created", t0, { customer: "Beta Traders" });
    await audit("Quotation", q.id, U_(arjun.id), "sent-for-approval", ago(2), { blended: risk.blended, maxLineOverage: risk.maxLineOverage, steps: ["SALES_MANAGER", "FINANCE"], reason: "a line is 8.0 pts over (> 5)" });
    await audit("Quotation", q.id, U_(meera.id), "approved", ago(1), { step: 1, reason: "Strategic account — regional head signed off on the tablet pricing" });
  }

  // Q3 — Nimbus (BRONZE) · Priya · SENT and stalled for 5 days
  {
    const t0 = ago(8);
    const { q } = await createQuotation({
      number: "Q-2026-0103",
      customer: nimbus,
      rep: priya,
      status: "SENT",
      createdAt: t0,
      lastActivityAt: ago(5),
      lines: [
        { sku: "HW-PRN-TL", qty: 4, disc: 5 },
        { sku: "HW-SCN-2D", qty: 4, disc: 5, variant: "Single" },
      ],
    });
    await audit("Quotation", q.id, U_(priya.id), "created", t0, { customer: "Nimbus Retail" });
    await audit("Quotation", q.id, SYS, "auto-approved: within policy", ago(6), { blended: 0, maxLineOverage: 0 });
    await audit("Quotation", q.id, U_(priya.id), "sent-to-customer", ago(5));
    await mkToken(nimbus.id, q.id, ago(5)); // expired — 72h window has passed
  }

  // Q4 — Orion Labs (GOLD) · Arjun · SENT yesterday — the ready portal link
  let demoPortalUrl = "";
  {
    const t0 = ago(2);
    const { q } = await createQuotation({
      number: "Q-2026-0104",
      customer: orion,
      rep: arjun,
      status: "SENT",
      createdAt: t0,
      lastActivityAt: ago(1),
      lines: [
        { sku: "HW-SCL-150", qty: 3, disc: 10 },
        { sku: "SV-CAL", qty: 3, disc: 5 },
        { sku: "SV-WAR-2Y", qty: 3, disc: 5 },
      ],
    });
    await audit("Quotation", q.id, U_(arjun.id), "created", t0, { customer: "Orion Labs" });
    await audit("Quotation", q.id, SYS, "auto-approved: within policy", ago(1, 2), { blended: 0, maxLineOverage: 0 });
    await audit("Quotation", q.id, U_(arjun.id), "sent-to-customer", ago(1));
    const tok = await mkToken(orion.id, q.id, ago(1));
    demoPortalUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/portal/q/${tok.token}`;
  }

  // Q5 — Zenith (SILVER) · Priya · UNDER_NEGOTIATION — customer countered on Setup Service
  {
    const t0 = ago(4);
    const { q } = await createQuotation({
      number: "Q-2026-0105",
      customer: zenith,
      rep: priya,
      status: "UNDER_NEGOTIATION",
      createdAt: t0,
      lastActivityAt: ago(1),
      lines: [
        { sku: "HW-LAP-14", qty: 4, disc: 10 },
        { sku: "SV-SETUP", qty: 4, disc: 7 },
        { sku: "SV-WAR-2Y", qty: 4, disc: 7 },
      ],
    });
    const setupLine = q.lines.find((l) => l.productId === sku("SV-SETUP").id)!;
    await audit("Quotation", q.id, U_(priya.id), "created", t0, { customer: "Zenith Corp" });
    await audit("Quotation", q.id, SYS, "auto-approved: within policy", ago(3), { blended: 0, maxLineOverage: 0 });
    await audit("Quotation", q.id, U_(priya.id), "sent-to-customer", ago(2));
    await prisma.portalMessage.create({
      data: { quotationId: q.id, lineId: setupLine.id, authorType: "CUSTOMER", body: "Can you match the 18% we got on setup last year? Otherwise we are good to go.", counterDiscountPct: 18, createdAt: ago(1) },
    });
    await audit("Quotation", q.id, { type: "CUSTOMER", id: zenith.id }, "counter-proposed", ago(1), { line: "On-site Setup Service", counterDiscountPct: 18 });
    await mkToken(zenith.id, q.id, ago(2));
  }

  // Q6 — Acme (GOLD) · Arjun · DRAFT (an hour old)
  {
    const t0 = ago(0, 1);
    const { q } = await createQuotation({
      number: "Q-2026-0106",
      customer: acme,
      rep: arjun,
      status: "DRAFT",
      createdAt: t0,
      lastActivityAt: t0,
      lines: [
        { sku: "HW-MON-27", qty: 6, disc: 0 },
        { sku: "HW-CHR-ERG", qty: 6, disc: 0 },
      ],
    });
    await audit("Quotation", q.id, U_(arjun.id), "created", t0, { customer: "Acme Industries" });
  }

  // Q7 — Beta (SILVER) · Priya · PENDING_MANAGER — small overage, manager only
  {
    const t0 = ago(0, 6);
    const { q, risk } = await createQuotation({
      number: "Q-2026-0107",
      customer: beta,
      rep: priya,
      status: "PENDING_MANAGER",
      createdAt: t0,
      lastActivityAt: ago(0, 5),
      lines: [
        { sku: "HW-UPS-1K", qty: 6, disc: 12 },
        { sku: "HW-SW-24", qty: 2, disc: 10 },
      ],
    });
    await prisma.approval.create({ data: { quotationId: q.id, step: 1, role: "SALES_MANAGER", status: "PENDING" } });
    await audit("Quotation", q.id, U_(priya.id), "created", t0, { customer: "Beta Traders" });
    await audit("Quotation", q.id, U_(priya.id), "sent-for-approval", ago(0, 5), { blended: risk.blended, maxLineOverage: risk.maxLineOverage, steps: ["SALES_MANAGER"] });
  }

  // Q8 — Zenith (SILVER) · Arjun · CONFIRMED 9 days ago, shipment still planned, promised date passed → slippage
  {
    const t0 = ago(14);
    const { q } = await createQuotation({
      number: "Q-2026-0108",
      customer: zenith,
      rep: arjun,
      status: "CONFIRMED",
      createdAt: t0,
      lastActivityAt: ago(2),
      lines: [
        { sku: "HW-MON-27", qty: 4, disc: 5 },
        { sku: "HW-WAP", qty: 2, disc: 5 },
      ],
    });
    const confirmedAt = ago(9);
    await audit("Quotation", q.id, U_(arjun.id), "created", t0, { customer: "Zenith Corp" });
    await audit("Quotation", q.id, SYS, "auto-approved: within policy", ago(13), { blended: 0, maxLineOverage: 0 });
    await audit("Quotation", q.id, U_(arjun.id), "confirmed", confirmedAt, { via: "internal" });
    const order = await prisma.order.create({ data: { quotationId: q.id, status: "IN_FULFILLMENT", promisedDate: ago(2) } });
    const totals = quotationTotals(q.lines);
    await prisma.invoice.create({ data: { orderId: order.id, kind: "ONE_TIME", amount: totals.net, tax: totals.tax, status: "POSTED", dueDate: new Date(confirmedAt.getTime() + 30 * DAY) } });
    await prisma.shipment.create({
      data: {
        orderId: order.id,
        warehouseId: main.id,
        status: "PLANNED",
        cost: R(400),
        lines: [
          { productId: sku("HW-MON-27").id, qty: 4 },
          { productId: sku("HW-WAP").id, qty: 2 },
        ],
      },
    });
    await audit("Order", order.id, U_(vikram.id), "split-accepted", ago(8), { plan: "1 shipment — ₹400, ships complete", warehouses: ["Main Warehouse"] });
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("\n✔ Seed complete\n");
  console.log("Demo logins (password: %s)", DEMO_PASSWORD);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.role.padEnd(14)} ${a.email.padEnd(24)} ${a.name}`);
  console.log("\nReady portal link (Orion Labs, Q-2026-0104, valid 72h):");
  console.log(`  ${demoPortalUrl}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
