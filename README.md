# DealFlow360

<p align="center">
  <img src="./assets/readme/hero.svg" alt="DealFlow360 – Self‑governing B2B sales operations" width="100%">
</p>

<p align="center">
  <strong>Quotations that route themselves, warehouse splits that explain themselves, hybrid billing with real proration, and a customer portal that is a genuinely separate, restricted view.</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript"></a>
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL"></a>
  <a href="#"><img src="https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma" alt="Prisma"></a>
  <a href="#"><img src="https://img.shields.io/badge/Test-Node.js-339933?style=flat-square&logo=node.js" alt="Test"></a>
  <a href="#"><img src="https://img.shields.io/badge/Odoo_Hackathon_2026-Finals-8B2B26?style=flat-square" alt="Odoo Hackathon 2026 Finals"></a>
</p>

---

## 🧭 The Problem

B2B deal execution is fragmented. Sales teams waste days waiting for approvals, finance loses margin to siloed warehouse data, and customers are left in the dark.

- **Margin leakage** – Sales reps lack real‑time visibility into product costs and warehouse stock, so they undersell or promise unavailable inventory.
- **Approval delays** – Every discount or custom terms need manager sign‑off, often via email or spreadsheets.
- **Fragmented warehouse stock** – No single source of truth for available inventory across locations, leading to overselling or split shipments that surprise the customer.
- **Hybrid billing complexity** – Mixed subscriptions, one‑time items, and usage‑based charges make invoicing error‑prone and hard to explain.
- **Slow customer negotiation** – Customers can't see the impact of their counter‑offers in real time, forcing back‑and‑forth emails.

---

## 💡 The Solution

DealFlow360 is a **self‑governing B2B deal engine** that encodes your business rules into configurable policies, then lets the system enforce them automatically. It turns a quote into a traceable workflow:

> **Quote → Risk Scoring → Approval Routing → Warehouse Allocation → Billing (with proration) → Customer Counter → Re‑approval → Confirmation → Payment**

Every step is driven by **pure business engines** (no hidden side‑effects), audited via an immutable `AuditEvent` log, and broadcasted in real‑time through Server‑Sent Events (SSE). The result is a transparent, fast, and trustworthy experience for both internal teams and external customers.

---

## ⚡ Key Differentiators

| Config‑driven | Pure Engines | Real‑time SSE | Audit Trail | RBAC + Separate Realms |
|---------------|--------------|---------------|-------------|--------------------------|
| Rules live in config, not code | `lib/engine/*` are pure functions (input → output) | Instant updates to both internal and portal views | Every action logged with context | Internal staff and customers have fully isolated auth and views |

---

## 🔄 End‑to‑End Deal Lifecycle

<img src="./assets/readme/deal-flow.svg" alt="Deal lifecycle flow" width="100%">

---

## 🧱 Architecture

<img src="./assets/readme/architecture.svg" alt="Architecture diagram" width="100%">

The system is built around four foundational layers:

1. **CONFIG** – Policies, approval matrices, warehouse mappings, and proration rules.
2. **ENGINES** – Pure functions in `lib/engine` that compute risk, routing, allocation, billing, anomaly detection, and upsell ranking.
3. **WORKFLOW** – API routes orchestrate data, call engines, persist changes, and emit SSE events.
4. **AUDIT** – Every mutation writes an `AuditEvent`, creating an immutable chain of custody.

**RBAC + Separate Auth Realms** ensure that internal users (sales, managers, finance, admin) operate in a dark, feature‑rich shell, while external customers see only their own quotations via a lightweight portal (`/portal/q/<token>`).

---

## ⚙️ Business Engines (Pure Functions)

All business logic lives in `lib/engine/` as pure functions – no database calls, no side effects. They are easily testable and maintainable.

- **Risk Scoring** – Evaluates quote attributes (discount depth, customer history, product mix) to assign a risk level (low/medium/high) and recommend an approval path.
- **Approval Routing** – Determines the required approvers based on risk score and organizational rules.
- **Warehouse Split** – Allocates ordered quantities across multiple warehouses to maximize availability, with fallback explanations.
- **Proration** – Calculates correct amounts for hybrid billing (subscriptions, one‑time, usage) with day‑exact proportional adjustments.
- **Anomaly Detection** – Flags unusual patterns (e.g., suspicious discounts, stock inconsistencies) before they become problems.
- **Upsell Ranking** – Suggests complementary products based on the quote content and warehouse stock.

---

## 🗄️ Database & Schema

The data model (defined in `prisma/schema.prisma`) captures the entire deal lifecycle:

- **User**, **Role** – RBAC for internal staff.
- **Quotation**, **LineItem** – Core quote structure.
- **Approval**, **ApprovalStep** – Multi‑stage approvals with status and timestamps.
- **Warehouse**, **Stock** – Inventory across locations.
- **Billing**, **Invoice**, **Payment** – Billing records and payment status.
- **AuditEvent** – Immutable log of all significant actions (who, what, when, context).
- **CustomerPortalToken** – Secure, token‑based access for customer views.

Relationships enforce referential integrity, and Prisma migrations keep the schema in sync.

---

## 🔐 RBAC & Security

- **Internal realms** – JWT tokens issued to staff; roles (`sales_rep`, `sales_manager`, `finance`, `admin`) control access to internal pages and API endpoints.
- **Customer realm** – Separate JWT tokens scoped to a single quotation; customers can view their quote, submit a counter‑offer, and see updates in real‑time.
- **Middleware** validates tokens and enforces route‑level permissions.
- All passwords are hashed (bcrypt), and tokens use a strong secret.

---

## 📡 Real‑Time Sync (SSE)

Server‑Sent Events (SSE) deliver live updates to both internal dashboards and customer portals. When a quote is approved, updated, or countered, all connected clients receive the new state without polling. This creates a responsive, collaborative feel.

---

## 🔍 Auditability

Every business‑critical action – creating a quote, routing for approval, approving/rejecting, allocating warehouse, billing, counter‑offer – persists an `AuditEvent` with:

- `userId` (or `customerTokenId`)
- `action` (e.g., `QUOTE_CREATED`, `APPROVAL_GRANTED`, `WAREHOUSE_ALLOCATED`)
- `targetId` (e.g., quotation id)
- `oldValue` / `newValue` (JSON snapshots of relevant state)
- `metadata` (IP, user agent, context)

This provides a complete, tamper‑evident history for compliance and debugging.

---

## 🖥️ Tech Stack

- **Framework** – Next.js 16 (App Router) with TypeScript.
- **Database** – PostgreSQL 16.
- **ORM** – Prisma 5.
- **Authentication** – Custom JWT (internal & customer realms).
- **Authorization** – RBAC (role‑based).
- **Real‑time** – Server‑Sent Events (SSE).
- **Validation** – Zod.
- **Testing** – Node.js native test runner (`node:test`).
- **Styling** – Hand‑rolled UI primitives (no external component libraries).
- **Fonts** – Self‑hosted, no CDNs.

---

## 📁 Repository Structure
