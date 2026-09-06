@AGENTS.md

# DealFlow360 — Master Build Prompt for Claude Code

> **How to use:** Save this file as `CLAUDE.md` in the root of an empty repo. Then drive Claude Code phase by phase using the kickoff messages in §12. Never say "build everything" — one phase per session, verify its acceptance test, commit, move on.

---

## 0) Mission & Context

You are building **DealFlow360**, a self-governing B2B sales operations platform, for the Odoo Hackathon 2026 finals (24-hour build, judged live by Odoo developers). The judges will personally walk an 8-step test flow (§11). Deliverables: working app with seed data, a 5-minute demo covering two end-to-end flows, a 1-page architecture diagram, and a "what we'd build next" note.

**Non-negotiables (from the organizers, verbatim intent):**
1. Core business rules (approval routing, discount governance, warehouse splitting, billing proration) must live in **application logic** — never hardcoded, never faked for the demo.
2. The customer portal must be a **real, separate, restricted view** — different auth, different layout, zero access to internal data.
3. Every approval, rejection, and edit is **logged with user, timestamp, and reason**.
4. **Zero external network dependencies at runtime.** No CDNs, no external APIs, no Google Fonts at runtime, no cloud DB. Everything runs on localhost with local Postgres. Demo Wi-Fi will fail; the app must not care.

**Your operating style:** implement exactly what this spec says. Where the spec is silent, choose the simplest correct option and leave a `// DECISION:` comment. Never stub business logic with fake data. Never mark a phase done until its acceptance test passes end-to-end in the browser.

---

## 1) Stack & Project Rules

- **Next.js 14+ (App Router, TypeScript)** — server components for reads, route handlers for mutations
- **PostgreSQL + Prisma** (local Postgres; connection string in `.env`)
- **Auth:** custom JWT in httpOnly cookies (no NextAuth, no external providers). Two independent auth realms: internal users and portal customers.
- **Styling:** Tailwind CSS + CSS variables for the token system in §3. No component libraries (no shadcn, no MUI) — hand-rolled components per §3 specs. It's faster than fighting a library's look and proves craft.
- **Realtime:** Server-Sent Events (native `ReadableStream` route handler) + 3s polling fallback.
- **Fonts:** `next/font` (self-hosted at build time): Bricolage Grotesque, Instrument Sans, JetBrains Mono.
- **Only these runtime npm deps beyond Next/Prisma/Tailwind:** `bcryptjs`, `jose` (JWT), `zod`, `canvas-confetti`. Nothing else without asking.
- Money: store as integer paise/cents (`Int`), display via one shared `formatMoney()` util. Percentages as `Float` (e.g. `12.5`).
- All list/table reads go through server components; all writes through `/api/*` route handlers that (a) validate with zod, (b) enforce role, (c) write an `AuditEvent`, (d) emit an SSE event when the entity is a quotation.

### Repo structure
```
/app
  /(internal)          ← JWT-internal layout, dark theme, top nav
    /quotations        ← list + pipeline (kanban toggle)
    /quotations/[id]   ← builder, approval, fulfillment, billing (tabs)
    /dashboard         ← deal health
    /reports
    /backend           ← config hub (A2–A7)
  /(portal)            ← customer layout, LIGHT theme, isolated
    /portal/q/[token]
  /api/...             ← route handlers + /api/events/[quotationId] (SSE)
/lib
  auth.ts  rbac.ts  audit.ts  sse.ts  money.ts
  engine/risk.ts  engine/routing.ts  engine/split.ts
  engine/proration.ts  engine/anomaly.ts  engine/upsell.ts
/prisma  schema.prisma  seed.ts
/components  (ui primitives + feature components)
```

Engine functions in `/lib/engine/*` are **pure functions** (inputs → outputs, no DB calls inside the math). This is what judges will read first.

---

## 2) Roles & Access (RBAC)

| Role | Can |
|---|---|
| SALES_REP | Build/edit own quotations, respond to portal messages, view own reports |
| SALES_MANAGER | Everything a rep can + approve step-1, configure discount tiers & chains, deal-health dashboard |
| FINANCE | Approve step-2, fulfillment split decisions, billing/credit notes |
| ADMIN | Full backend config + all analytics |
| CUSTOMER (portal) | View own quotation via magic link, comment per line, counter-discount, confirm. **Nothing else.** |

Enforce in `lib/rbac.ts` with a single `can(user, action, resource)` helper used by every route handler. Portal routes never import internal auth; internal routes never accept portal tokens.

---

## 3) Design System — "Meridian"

**Design thesis:** a trading-desk for deals. Calm, dark, dense, Linear/Stripe-grade restraint — and exactly **one** loud element: the **Risk & Margin rail** on the quotation builder (live risk arc + counting numbers). Everything else stays quiet so that rail owns the room. The customer portal is the deliberate opposite: warm, light, paper-like — so in the side-by-side demo, everyone instantly sees which screen is internal and which is the customer's. The theme split *is* the "separate restricted view" made visible.

### 3.1 Color tokens (CSS variables in `globals.css`)

**Internal (dark) — default on `(internal)` layout:**
```css
--bg:        #101423;   /* indigo-black, not neutral black */
--surface:   #171C30;
--raised:    #1E2440;
--border:    rgba(163,178,255,0.10);
--text:      #EDF0FB;
--muted:     #9AA5C8;
--primary:   #7C8CFF;   /* periwinkle-indigo, hover #93A0FF */
--primary-2: #6A5CFF;   /* gradient partner, primary CTAs only */
--money:     #3ECF8E;   /* ONLY for margin/positive currency */
--warn:      #F5B942;
--danger:    #F0654E;
--info:      #6FB7FF;
```
**Portal (light) — on `(portal)` layout:**
```css
--bg: #F6F5F1;  --surface: #FFFFFF;  --border: #E4E1D8;
--text: #1B1E28;  --muted: #6B7080;
/* same accent hues, darkened one step for AA contrast */
```
**Rule: color = meaning.** Mint = money/margin/approved. Amber = pending/warning. Coral = risk/over-ceiling/rejected. Indigo = interactive. Never use accents decoratively.

### 3.2 Typography
- **Bricolage Grotesque** 600/700 — page titles, section headers, the big risk number. Display sizes: 30/24/19px, tight tracking (−0.01em).
- **Instrument Sans** 400/500/600 — all UI text, body 14px/1.5, labels 13px sentence case (no ALL-CAPS labels anywhere).
- **JetBrains Mono** 500 — currency, percentages, quantities, quote numbers only, always `font-variant-numeric: tabular-nums`, right-aligned in tables. Do not use mono for prose or labels.

### 3.3 Depth, buttons, "3D feel"
No skeuomorphic 3D, no glassmorphism sheets, no animated page backgrounds. Tactility comes from three cheap tricks:
- **Primary button:** `linear-gradient(180deg, var(--primary), var(--primary-2))`, 1px inset top highlight `rgba(255,255,255,.22)`, shadow `0 2px 10px rgba(108,110,255,.35)`; hover raises 1px; **:active translates down 1px and compresses the shadow** — that press is the whole "3D button." Radius 8.
- **Radius hierarchy** (never one radius everywhere): modals/shell 16 · cards 12 · inputs/buttons 8 · status pills 999.
- **Cards:** surface + 1px border only. No drop shadows on cards, no hover lift.
- The **only ambient animation in the app** is the login screen: a 30s CSS conic-gradient drift behind the card, indigo→deep blue, opacity 0.35. Nothing animated behind data. Ever.

### 3.4 Motion budget (exhaustive — nothing outside this list)
1. **Number tickers** (400ms count-up/down) on: order total, live margin %, blended risk score.
2. **Risk arc** sweep on recompute (SVG stroke-dashoffset, 500ms).
3. **SSE update flash:** changed row/panel pulses `--raised` → normal over 500ms + toast ("Customer countered 18% on Setup Service").
4. Status pill crossfade on state change (200ms).
5. **One** `canvas-confetti` burst when the customer clicks Confirm Quotation. Once.
6. All transitions 150–200ms ease-out. `prefers-reduced-motion: reduce` disables 1–5.

No scroll-triggered animations. No card entrance animations. No hover transforms on cards.

### 3.5 Layout & alignment
- Internal shell: **top nav** (per PS B1): left = wordmark + Quotations · Pipeline · Dashboard · Reports; right = Reload Data · Go to Backend · Close Workspace + user chip. Content `max-w-[1440px]`, 24px gutters, 4px spacing grid, everything left-aligned.
- **Quotation Builder** = the signature screen: 12-col grid; cols 1–7 product picker + cart table; cols 8–12 sticky right rail with (top→bottom) Risk arc + blended score, live margin ticker, per-line overage chips, Upsell panel. The rail is the one bold element.
- **Tables** (Stripe-style): 44px rows, 13px, sticky header, numeric columns mono + right-aligned, row hover = background tint only, per-row kebab menu.
- **Portal:** single centered 720px column, light theme, quotation reads like a well-set document; sticky bottom bar with `Confirm quotation` (mint) and `Propose changes`.
- Kanban pipeline: columns = Draft · Pending approval · Approved/Sent · Under negotiation · Confirmed; cards show customer, total (mono), risk chip, days-since-activity.

### 3.6 Microcopy
Sentence case everywhere. Buttons say what happens: "Send for approval", "Accept suggested split", "Record payment". Empty states instruct: "No quotations yet — create one to see the pipeline." Errors say what to fix, never apologize.

---

## 4) Prisma Schema (implement exactly; add indexes where marked)

```prisma
enum Role { SALES_REP SALES_MANAGER FINANCE ADMIN }
enum Tier { BRONZE SILVER GOLD }
enum ProductKind { ONE_TIME RECURRING }
enum QuoteStatus { DRAFT PENDING_MANAGER PENDING_FINANCE APPROVED SENT UNDER_NEGOTIATION CONFIRMED REJECTED }
enum ApprovalStatus { PENDING APPROVED REJECTED RETURNED }
enum PlanInterval { MONTHLY QUARTERLY YEARLY }
enum CancelRule { PRORATED_CREDIT NO_REFUND }
enum OrderStatus { CONFIRMED IN_FULFILLMENT PARTIALLY_SHIPPED COMPLETED }
enum ShipmentStatus { PLANNED SHIPPED DELIVERED }
enum InvoiceKind { ONE_TIME RECURRING CREDIT_NOTE }
enum InvoiceStatus { DRAFT POSTED PAID }

model User { id String @id @default(cuid()); name String; email String @unique;
  passwordHash String; role Role; quotations Quotation[]; createdAt DateTime @default(now()) }

model Customer { id String @id @default(cuid()); name String; company String;
  email String @unique; tier Tier; city String
  quotations Quotation[]; portalTokens PortalToken[]; history HistoricalOrder[] }

model PortalToken { id String @id @default(cuid()); token String @unique
  customerId String; customer Customer @relation(fields:[customerId], references:[id])
  quotationId String; expiresAt DateTime; usedAt DateTime? }

model Category { id String @id @default(cuid()); name String @unique
  products Product[]; policies DiscountPolicy[] }

model Product { id String @id @default(cuid()); name String; sku String @unique
  categoryId String; category Category @relation(fields:[categoryId], references:[id])
  kind ProductKind; unit String; cost Int; listPrice Int; taxPct Float
  description String; isPromoted Boolean @default(false)
  attributeName String?; variants ProductVariant[] }

model ProductVariant { id String @id @default(cuid()); productId String
  product Product @relation(fields:[productId], references:[id])
  value String; extraPrice Int }

model PriceListItem { id String @id @default(cuid()); tier Tier; productId String
  price Int  @@unique([tier, productId]) }
  // effective list price = PriceListItem(tier, product) ?? product.listPrice

model DiscountPolicy { id String @id @default(cuid()); tier Tier
  categoryId String; category Category @relation(fields:[categoryId], references:[id])
  ceilingPct Float  @@unique([tier, categoryId]) }

model ApprovalConfig { id Int @id @default(1)
  managerBlendedMaxPts Float @default(3)   // blended ≤ this → manager only
  financeLineOveragePts Float @default(5)  // any line over by > this → +finance
  financeAmountThreshold Int @default(50000000) // order total (paise) → +finance
  stalledDays Int @default(3); anomalySigma Float @default(2) }

model SubscriptionPlan { id String @id @default(cuid()); name String
  interval PlanInterval; cancelRule CancelRule @default(PRORATED_CUSTOM_SEE_NOTE) }
  // note: use PRORATED_CREDIT as the default value; line above shown for emphasis only

model Warehouse { id String @id @default(cuid()); name String; city String
  shippingCostWeight Int   // per-shipment cost proxy, paise
  stock Stock[] }

model Stock { id String @id @default(cuid())
  warehouseId String; warehouse Warehouse @relation(fields:[warehouseId], references:[id])
  productId String; qty Int  @@unique([warehouseId, productId]) }

model Quotation { id String @id @default(cuid()); number String @unique
  customerId String; customer Customer @relation(fields:[customerId], references:[id])
  repId String; rep User @relation(fields:[repId], references:[id])
  status QuoteStatus @default(DRAFT)
  blendedRiskScore Float @default(0); maxLineOverage Float @default(0)
  promisedDate DateTime?
  lines QuotationLine[]; approvals Approval[]; messages PortalMessage[]
  order Order?
  createdAt DateTime @default(now()); lastActivityAt DateTime @default(now())
  @@index([status]); @@index([repId]) }

model QuotationLine { id String @id @default(cuid())
  quotationId String; quotation Quotation @relation(fields:[quotationId], references:[id], onDelete: Cascade)
  productId String; variantId String?; planId String?
  qty Int; unitPrice Int; discountPct Float @default(0); isRecurring Boolean @default(false) }

model Approval { id String @id @default(cuid())
  quotationId String; quotation Quotation @relation(fields:[quotationId], references:[id])
  step Int; role Role; status ApprovalStatus @default(PENDING)
  approverId String?; reason String?; actedAt DateTime? }

model PortalMessage { id String @id @default(cuid())
  quotationId String; quotation Quotation @relation(fields:[quotationId], references:[id])
  lineId String?; authorType String    // "CUSTOMER" | "REP"
  body String; counterDiscountPct Float?; createdAt DateTime @default(now()) }

model Order { id String @id @default(cuid())
  quotationId String @unique; quotation Quotation @relation(fields:[quotationId], references:[id])
  status OrderStatus @default(CONFIRMED); promisedDate DateTime?
  shipments Shipment[]; backorders Backorder[]; invoices Invoice[]; schedule BillingEntry[] }

model Shipment { id String @id @default(cuid())
  orderId String; order Order @relation(fields:[orderId], references:[id])
  warehouseId String; status ShipmentStatus @default(PLANNED); cost Int
  lines Json }   // [{productId, qty}]

model Backorder { id String @id @default(cuid())
  orderId String; order Order @relation(fields:[orderId], references:[id])
  productId String; qty Int; status String @default("OPEN") } // OPEN | CONSOLIDATED

model Invoice { id String @id @default(cuid())
  orderId String; order Order @relation(fields:[orderId], references:[id])
  kind InvoiceKind; amount Int; tax Int; status InvoiceStatus @default(DRAFT)
  dueDate DateTime?; payments Payment[] }

model BillingEntry { id String @id @default(cuid())
  orderId String; order Order @relation(fields:[orderId], references:[id])
  lineId String; billOn DateTime; amount Int; status String @default("SCHEDULED") } // SCHEDULED | INVOICED

model Payment { id String @id @default(cuid())
  invoiceId String; invoice Invoice @relation(fields:[invoiceId], references:[id])
  amount Int; method String; paidAt DateTime @default(now()) }

model AuditEvent { id String @id @default(cuid())
  entityType String; entityId String; actorType String; actorId String?
  action String; meta Json?; createdAt DateTime @default(now())
  @@index([entityType, entityId]) }

model HistoricalOrder { id String @id @default(cuid())
  repId String; customerId String; customer Customer @relation(fields:[customerId], references:[id])
  orderDiscountPct Float; total Int; productIds String[]; createdAt DateTime }
```

---

## 5) Business Logic — exact formulas (pure functions in `/lib/engine/`)

### 5.1 Risk score (`risk.ts`)
```
effectiveList(line)  = PriceListItem(customer.tier, product) ?? product.listPrice (+ variant.extraPrice)
ceiling(line)        = DiscountPolicy(customer.tier, product.category).ceilingPct
overage(line)        = max(0, line.discountPct − ceiling(line))          // points
weight(line)         = line.qty × effectiveList(line)
blendedRiskScore     = Σ overage(line)·weight(line) / Σ weight(line)     // revenue-weighted pts
maxLineOverage       = max over lines of overage(line)
liveMarginPct        = (Σ (netUnit − cost)·qty) / (Σ netUnit·qty) × 100,  netUnit = effectiveList·(1 − discountPct/100)
```
Return `{blended, maxLineOverage, perLine: [{lineId, ceiling, overage}], marginPct}`. The builder rail renders per-line chips from `perLine` ("Setup Service: 8.0 pts over its 10% ceiling").

### 5.2 Approval routing (`routing.ts`) — reads `ApprovalConfig`, never literals
```
if blended == 0 and maxLineOverage == 0            → AUTO_APPROVED (status APPROVED, audit "auto-approved: within policy")
elif blended ≤ managerBlendedMaxPts
     and maxLineOverage ≤ financeLineOveragePts
     and total < financeAmountThreshold            → steps: [SALES_MANAGER]        → PENDING_MANAGER
else                                               → steps: [SALES_MANAGER, FINANCE] → PENDING_MANAGER, then PENDING_FINANCE
```
Rules: rep cannot self-approve. Approve advances to next step or APPROVED. Reject → REJECTED (reason required). Return-for-revision → DRAFT (reason required). **Any edit to lines or any accepted portal counter re-runs risk + routing from scratch** — old approvals are voided (audit "re-entered approval: terms changed").

### 5.3 Warehouse split (`split.ts`) — greedy, explainable
```
1. Candidates that fully cover ALL lines alone → pick min shippingCostWeight → Plan A (1 shipment).
2. Else greedy: sort warehouses by (coverage of remaining demand desc, shippingCostWeight asc);
   assign what each can supply; repeat. Unfulfilled remainder → Backorder rows.
3. planCost = Σ chosen warehouses' shippingCostWeight (one per shipment).
4. Also compute the best alternative plan (e.g. fewer shipments + backorder) and return BOTH:
   [{label:"2 shipments — ₹840, ships complete", …}, {label:"1 shipment — ₹560 + 3 units backordered", …}]
```
UI shows both plans compared → `Accept suggested split` or `Manual override` (editable per-warehouse qty table that must sum to ordered qty; validate). Accepting decrements `Stock` and creates `Shipment`s.
**Simulate stock arrival** (button on fulfillment screen, FINANCE/ADMIN): adds configurable qty to a warehouse → if OPEN backorders for that product exist, show the "Consolidate remaining backorder" prompt → one click creates the consolidation shipment and marks backorders CONSOLIDATED.

### 5.4 Hybrid billing & proration (`proration.ts`)
- On order confirm: one-time lines → one `Invoice(kind ONE_TIME, POSTED)` incl. tax. Recurring lines → `BillingEntry` rows for the next 3 cycles from confirm date by plan interval (amount = netUnit×qty per cycle); a "Generate invoice" action on a due entry creates `Invoice(kind RECURRING)` and marks it INVOICED.
- **Mid-cycle qty change:** `periodDays` = days in current cycle, `remaining` = days from change→cycle end.
  `deltaCharge = (newQty − oldQty) × netUnit × remaining/periodDays` → if positive, prorated RECURRING invoice; if negative and plan.cancelRule = PRORATED_CREDIT, a CREDIT_NOTE for |delta|. Future entries recalc at new qty.
- **Cancel subscription line:** PRORATED_CREDIT → credit note `qty × netUnit × remaining/periodDays`, future entries removed; NO_REFUND → future entries removed only. Audit everything.
- `Record payment` on a POSTED invoice → Payment row, invoice → PAID, ticker updates.

### 5.5 Portal negotiation
Magic link: rep clicks "Send to customer" → creates PortalToken (72h expiry), status SENT, shows copyable URL `/portal/q/{token}` (no email needed — paste it in the demo). Token resolves → httpOnly portal-realm cookie scoped to that quotation.
Portal can: view doc, comment per line, propose `counterDiscountPct` per line, `Confirm quotation`.
- Counter proposal → status UNDER_NEGOTIATION, SSE to rep, rep gets Accept/Decline per counter. **Accept** applies the discount → §5.2 rerun (this is test step 7: over-threshold counters auto re-enter approval).
- Confirm → if current terms need approval, block with "Your requested terms are with our approvals team" and route internally; else quotation CONFIRMED, Order created, confetti (once).

### 5.6 Deal health & anomalies (`anomaly.ts`)
- **Stalled:** status ∈ {SENT, UNDER_NEGOTIATION, PENDING_*} and `lastActivityAt` older than `stalledDays`. (Touch `lastActivityAt` on every audited action.)
- **Discount anomaly:** per rep from `HistoricalOrder`: μ, σ of `orderDiscountPct`. Flag active quotes where weightedAvgDiscount > μ + `anomalySigma`·σ (and > 5%). Card copy: "Rahul's avg discount is 6.2% — this quote is at 19%."
- **Slippage:** order.promisedDate < today and any shipment not DELIVERED.
- Each alert card → click opens the quotation; `Nudge rep` button writes an AuditEvent "nudge" + toast (that's the "automated nudge/escalation action").

### 5.7 Upsell (`upsell.ts`)
From `HistoricalOrder.productIds`, compute co-purchase counts with items in the cart at query time.
`score = coCount × (isPromoted ? 1.5 : 1)`; drop candidates whose marginPct < 15 (config constant with `// DECISION:`). Show top 5: name, `marginDelta = (netUnit − cost)` for qty 1 (mono, mint), "Promoted" pill if applicable, `Add to quote` / `Dismiss`. Adding re-runs §5.1 → tickers move — that's the demo beat.

### 5.8 SSE (`sse.ts`)
In-memory `Map<quotationId, Set<controller>>`. `GET /api/events/[quotationId]` streams; every mutation route calls `emit(quotationId, {type, payload})`. Client hook `useQuoteEvents(id)` refreshes data via router.refresh() + fires the flash/toast. Poll every 3s as fallback if the stream errors.

---

## 6) Screens (route → must-haves; mirror the Excalidraw mockup for structure)

**Internal**
- `/login` — the one ambient-animated screen; seed-account hint list for demo speed.
- `/quotations` — table + Kanban toggle (B2). New quotation → pick customer (tier badge).
- `/quotations/[id]` — **Builder** (B3+B5): picker with category tabs (Hardware/Services/Subscriptions), cart table (qty steppers, per-line discount input, line total mono), order-level discount, right rail = risk arc + blended score + margin ticker + overage chips + upsell panel. Primary action is contextual: "Send for approval" when routing requires it, else "Confirm & fulfil".
- `…/approval` (B4): step list (Manager → Finance shown only when required), blended score, per-line policy table (given vs ceiling vs overage), Approve / Reject / Return-with-reason, then the **audit timeline** (every AuditEvent for this quote, newest last — this stays visible on every tab).
- `…/fulfillment` (B6): both split plans compared, accept/override, shipments list, backorders, **Simulate stock arrival** → consolidate prompt.
- `…/billing` (B7): one-time invoice block; recurring schedule table (next 3 cycles); change-qty → proration preview modal ("Charge ₹X for 14 remaining days") → confirm; cancel → credit-note preview; Record payment.
- `/dashboard` (B9): three alert columns (Stalled / Discount anomalies / Delivery slippage) as clickable cards + Nudge, plus 4 KPI tickers (open pipeline value, avg margin, pending approvals, confirmed this week).
- `/reports` (A7): filters Period · Rep/Team · Approval status · Product/Category; results table + totals; `Export CSV` (client blob); `Print / PDF` = `window.print()` with a print stylesheet (light, no chrome).
- `/backend` (A1–A6): plain CRUD, no polish budget — Products (+variants, one attribute), Price list items per tier, **Discount policy matrix** (tier × category grid of ceiling inputs — this one editable grid demos governance config in 10 seconds), Approval thresholds form, Warehouses + stock, Plans, Upsell (read-only ranked co-purchase pairs table labeled "learned from order history").

**Portal**
- `/portal/q/[token]` — light theme, 720px doc: header (number, status pill, valid-until), line items with per-line "Ask / propose change" popover (comment + counter %), totals, sticky bar: `Confirm quotation` / `Propose changes`. After confirm: success state + "Our team will be in touch." Nothing else is reachable.

---

## 7) Seed data (`prisma/seed.ts`) — realism is a judging feature
- Users: 2 reps (Priya, Arjun), 1 manager (Meera), 1 finance (Vikram), 1 admin. Password `df360-demo-2026`.
- Customers (5): Acme Industries (GOLD), Beta Traders (SILVER), Nimbus Retail (BRONZE), Orion Labs (GOLD), Zenith Corp (SILVER) — Indian cities.
- Categories: Hardware, Services, Subscriptions. ~24 products with believable cost/list gaps (hardware margin ~35%, services ~55%, subs ~70%); 6 promoted; 2 hardware items share attribute "Pack" with variants; 4 subscription products linked to plans (Monthly/Quarterly/Yearly, PRORATED_CREDIT and one NO_REFUND).
- Discount policy matrix: Bronze 5/3/5, Silver 10/7/10, Gold 15/10/12 (Hardware/Services/Subscriptions) — note Services deliberately strictest (mirrors the PS example).
- Warehouses: Main Warehouse (Ahmedabad, weight 400), East Depot (Kolkata, 650), South Hub (Bengaluru, 560). Stock arranged so one seeded demo product set **forces a 2-warehouse split**, and one product is short everywhere (forces backorder).
- ApprovalConfig defaults per §4. 40 HistoricalOrders across both reps over 6 months: Priya μ≈6%, Arjun μ≈9%, σ small — so an 18–19% demo quote triggers the anomaly. Product co-occurrence deliberately pairs (Laptop ↔ Setup Service ↔ Extended Warranty; Scale ↔ Calibration Service) so upsell suggestions look intelligent.
- 6 pre-made quotations spread across pipeline stages (one stalled 5 days, one pending finance) so dashboard and Kanban are alive at first login.
- Seed prints all demo logins + one ready portal URL to the console.

---

## 8) Phase plan (one Claude Code session each; commit after acceptance passes)

| Phase | Build | Acceptance (browser-verified) |
|---|---|---|
| P1 | Scaffold, tokens/§3 primitives (Button, Card, Table, Pill, Input, Toast, NumberTicker, RiskArc), Prisma schema, seed, both auth realms, internal shell + login | Log in as each role; portal URL from seed resolves to isolated light page; wrong realm cookie rejected |
| P2 | Builder + risk engine + routing + approval screens + audit timeline + upsell panel | **Test steps 1–4:** over-ceiling discount auto-routes without manual request; accepted upsell moves total+margin tickers instantly |
| P3 | Fulfillment: split plans, override, shipments, backorder, simulate-arrival + consolidate | **Step 5:** seeded demo order splits across two warehouses; arrival triggers consolidate prompt |
| P4 | Billing: hybrid invoice + schedule, proration modal, credit note, record payment | **Step 6 + 8b:** one-time and recurring billed separately & correctly; payment flips invoice to PAID |
| P5 | Portal negotiation + SSE + auto re-approval loop | **Step 7:** customer counters above ceiling → rep screen flashes live → accept → quote re-enters approval automatically |
| P6 | Dashboard (stalled/anomaly/slippage + nudge), reports with 4 filters, CSV, print stylesheet | Anomaly card names the rep's μ; every filter changes results; print preview is clean |
| P7 | Polish pass: seed realism, empty states, reduced-motion check, run §11 three times uninterrupted | Full 8-step run with zero manual DB touches |

---

## 9) Explicit cut list — do NOT build
Multi-currency/multi-company (PS: bonus) · upsell rule-authoring UI (PS: optional — read-only learned pairs instead) · email sending · XLS (CSV only) · replenishment rules (simulate-arrival button replaces) · more than one variant attribute · password reset · dark/light toggle (theme is fixed per realm, by design).

## 10) Working agreement for Claude Code
- One phase per session. Start by re-reading this file's relevant sections. End by running the phase's acceptance in the browser, then `git commit`.
- After any schema change: `npx prisma migrate dev && npx prisma db seed`.
- If something in this spec is ambiguous or conflicts, ask **one** short question, don't improvise silently on business rules. UI details you may decide alone within §3.
- Never introduce a network call to anything outside localhost.
- Keep engine functions pure and unit-testable; add a tiny `engine.test.ts` with 3 cases for risk + proration (judges may ask "prove the math").

## 11) The 8-step judge flow (memorize; this is the grade)
1. Log in; confirm a discount tier, a warehouse, and a subscription plan exist in backend.
2. New quotation; add a line with a discount above its ceiling.
3. Confirming auto-routes to manager approval — rep never asks manually.
4. Accept one upsell suggestion; total and margin update immediately.
5. Approve; stock pulls from the correct warehouse, splitting across two when needed.
6. One-time product + subscription on the same order bill correctly and separately.
7. In the portal, request a bigger discount as the customer; the quote re-enters approval automatically.
8. Confirm the order, record a payment, invoice status updates correctly.

## 12) Kickoff messages (paste into Claude Code, one per session)
- **P1:** "Read CLAUDE.md fully. Execute Phase P1 exactly: scaffold, design tokens and primitives per §3, full schema per §4, seed per §7, both auth realms per §2/§5.5. Stop at P1 acceptance and show me how to verify."
- **P2:** "Phase P2. Implement /lib/engine/risk.ts and routing.ts per §5.1–5.2 as pure functions with the unit tests from §10, then the builder screen and right rail per §6, approvals + audit timeline. Verify test steps 1–4."
- **P3–P6:** same pattern — "Phase Pn per §5.x + §6. Verify: [that phase's acceptance]."
- **P7:** "Run the full §11 flow yourself with Playwright-style manual steps, list anything broken, fix, re-run. Then improve seed realism and empty states. No new features."
