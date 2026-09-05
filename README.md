# DealFlow360

Self-governing B2B sales operations — quotations that route their own approvals, warehouse splits that explain themselves, hybrid billing with real proration, and a customer portal that is a genuinely separate, restricted view.

Built for the Odoo Hackathon 2026 finals. Everything runs on localhost: Next.js 16 (App Router), PostgreSQL + Prisma, self-hosted fonts, no CDNs, no external APIs.

## Run it

```bash
# Prerequisites: Node 20.9+, a local PostgreSQL (defaults assume `postgresql://<you>@localhost:5432/dealflow360`)
createdb dealflow360
cp .env.example .env            # adjust DATABASE_URL if your Postgres user differs
npm install
npx prisma migrate deploy       # creates the tables
npx prisma db seed              # demo data + prints logins and a ready portal link
npm run dev                     # http://localhost:3000
```

Demo password for every account is `demo1234`:

| Role | Email |
| --- | --- |
| Sales rep | priya@dealflow.local |
| Sales rep | arjun@dealflow.local |
| Sales manager | meera@dealflow.local |
| Finance | vikram@dealflow.local |
| Admin | admin@dealflow.local |

The seed prints a customer portal link (`/portal/q/<token>`) for a quotation that is already sent — open it in a private window to play the customer side-by-side.

## Prove the math

```bash
npm test          # node:test cases for risk scoring, routing, proration and warehouse split
```

The business rules live in `lib/engine/*` as pure functions (inputs → outputs, no database calls). Route handlers in `app/api/*` resolve data, call the engine, write an `AuditEvent`, and emit a Server-Sent Event.

## Layout

```
app/(auth)      login + / redirect          app/(internal)  dark shell, JWT-internal realm
app/(portal)    light customer portal       app/api         route handlers (mutations, SSE)
lib/engine      pure business rules         lib/*.ts        auth realms, rbac, audit, sse, money
prisma          schema, migrations, seed    components      hand-rolled UI primitives + features
```
