# What to tell the judges

The judges are Odoo developers who will walk the eight-step flow themselves. They have seen a
lot of quote-to-invoice forms today. Everything below is checked against the code — do not
claim anything that is not on this page.

---

## The one line

> "Most teams built a quotation form. We built the thing that decides whether a quotation is
> allowed to exist. The discount score picks its own approver, and nobody in the app can
> override that by hand."

---

## Lead with these three

**1. The rules are not in the code.**
Open **Backend → Discount policy**. That grid is what the engine reads at runtime. Change gold
services from 10 to 20, save, and the same quotation stops needing approval. Say it out loud:
*"there is no `if discount > 15` anywhere in this repo."* It is true — every threshold in
`lib/engine/routing.ts` arrives as a parameter.

**2. The portal is a different system, not a hidden menu.**
Two modules, two JWT secrets, two cookies, and neither file imports the other. Show
`lib/auth.ts` and `lib/portal-auth.ts` side by side. A portal cookie sent to an internal
endpoint returns 401, and an internal cookie sent to a portal endpoint returns 401. Both
directions are asserted in the test run.

**3. The loop closes by itself.**
The customer counters a discount, the rep accepts, and the quotation re-enters approval with
the earlier sign-offs voided. Nobody pressed anything to make that happen. The audit line reads
`re-entered approval: terms changed`.

---

## The questions they will actually ask

**"How do I know this isn't hardcoded for the demo?"**
Three answers, in order of strength. Edit the ceiling grid live and re-run the quote. Open
`lib/engine/routing.ts` — it is about sixty lines and takes its limits as arguments. Then
`npm test`, which asserts the arithmetic against worked examples.

**"Prove the math."**
`npm test` runs seven cases. Quote one: a ten-line cart at 20% against a 15% ceiling gives a
blended 4.56 points, and a ten-to-fourteen seat change fourteen days into a thirty-one day cycle
bills ₹975.48. Both are in `lib/engine/engine.test.ts` with the working shown in comments.

**"Your own problem statement has a worked example. Does it match?"**
Yes, and offer this before they ask. The PDF's gold customer with a laptop at 12% against 15%
and setup service at 18% against 10% comes out at exactly **8 points over on the service line**
and gets flagged. We ran that example through the engine.

**"What happens if a rep approves their own quotation?"**
They cannot. It returns 403. Try it on camera if there is time — it is a one-click proof that
the guard is real rather than a hidden button.

**"Is the audit trail actually complete?"**
Nineteen action types. The useful detail is `actorType`, which is `USER`, `CUSTOMER` or
`SYSTEM` — so an automatic approval is recorded against the system and can never be mistaken
for a human decision. Scroll the timeline on any quotation; it is on every tab.

**"Does the warehouse split just pick the cheapest?"**
No, and this is worth dwelling on. It returns **two plans and explains both**: two shipments at
₹960 that ship complete, against one shipment at ₹560 with a unit backordered. It presents the
trade-off instead of hiding it. Services never enter the split, because they are not stocked.

---

## Say these before they find them

Being first about the gaps reads as judgement. Being caught reads as padding.

- **No replenishment rules.** Deliberate. The simulate-arrival button covers the same demo beat
  in one click, and we would rather have the consolidation flow working than a settings page.
- **CSV export, not XLS.** The print view produces the PDF. XLS was not worth the dependency.
- **Single currency.** The statement calls multi-currency a bonus. Money is stored as integer
  paise behind one formatter, so adding it is a column and a rate table, not an audit of every
  calculation.
- **Signup cannot create an admin.** Admin owns the configuration every engine reads. Letting
  anyone with the URL grant themselves that would make the governance story meaningless. Asking
  for it is rejected by the schema, not merely hidden in the dropdown.

---

## Numbers worth quoting

| | |
|---|---|
| Pure engine modules, no database calls in the maths | 6 |
| Route handlers, each validating, authorising and auditing | 35 |
| Prisma models | 24 |
| Audit action types | 19 |
| Scripted judge-flow assertions, passing on a fresh seed | 54 |
| Engine unit tests | 7 |
| Runtime network calls | 0 |

The 54 is the one to lead with. Say that the eight-step flow is **scripted and run three times
on a freshly seeded database**, and that every assertion compares against the database rather
than a hardcoded expectation — so the invoice totals, cycle amounts and stock movements are
checked against the rows themselves.

---

## If a step misbehaves live

Do not narrate around it. Say what you expected, say what happened, and move on. Judges who
build software respect that far more than a save. Then offer the scripted run as evidence the
path normally works.

## The closing line

> "Business rules in pure functions, a customer portal that is genuinely a separate system, an
> audit trail on every mutation, and it runs entirely on this laptop with no network calls.
> Everything you just watched was decided by the engines, not by the demo."
