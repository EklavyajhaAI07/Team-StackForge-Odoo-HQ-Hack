# DealFlow360 — five minute demo script

Two complete flows, as the deliverable asks. **Flow A** takes a quotation from build to paid-ready
through discount governance, warehouse splitting and hybrid billing. **Flow B** is the customer
negotiating in the portal and the quote re-entering approval on its own.

Every figure below was run against the seeded database and is what will appear on screen. If a
number differs, the seed has drifted — reset with `npx prisma db seed`.

---

## Before you record

```bash
npx prisma db seed     # pristine state, and it prints a fresh portal link
npm run dev            # must be port 3000; the portal link points there
```

**Set up four browser tabs, all logged in before you hit record.** Switching users on camera
costs 20 seconds each time and is the main reason these demos overrun.

| Tab | Who | Open at | Sign in with |
|---|---|---|---|
| 1 | Priya Sharma, rep | `/quotations` | `priya@dealflow.local` |
| 2 | Meera Iyer, manager | `/quotations` | `meera@dealflow.local` |
| 3 | Vikram Rao, finance | `/quotations` | `vikram@dealflow.local` |
| 4 | The customer | the portal link from the seed | no login, the link is the auth |

Password is `demo1234`. Tab 4 must be a **private window**, otherwise it shares cookies with
your internal session and the two realms will not look separate.

Take the portal link from the seed output. It changes every reseed.

> Tab 4 is Arjun's customer, so **Flow B needs Arjun** to answer the counter. Either add a fifth
> tab for `arjun@dealflow.local`, or reassign by using Q-2026-0105 instead. A fifth tab is simpler.

---

## Flow A — build, govern, fulfil, bill · target 2:15

### 1. Open on the pipeline · Tab 1 · 0:00–0:20

**Do:** start on `/quotations`. Let the table sit for a beat, then click **Board**.

> "This is a sales desk with eight live quotations. Some are drafts, some are waiting on approval,
> one is under negotiation with a customer. The board is the same data by stage."

**Do:** point at the amber `1.3 pts` and `7.5 pts` chips.

> "Those numbers are how far each quote has pushed past the discount policy. That score is what
> decides who has to approve it. Nobody picks an approver by hand."

### 2. Build a quotation · Tab 1 · 0:20–1:05

**Do:** click **New quotation**, choose **Acme Industries**, create.

> "Acme is a gold-tier customer, so their ceilings are the most generous we allow."

**Do:** in the picker, add **ProBook 14 Business Laptop**. Set quantity to **9** and discount to **17**.

**Say while the rail moves:**

> "Gold customers can have fifteen percent on hardware. I have just given seventeen. Watch the rail."

**Do:** point at the risk arc and the red chip.

> "Two points over its ceiling. Live margin nineteen point zero eight percent, order four lakh
> forty-eight thousand two hundred. The rail says this now needs a manager, and I have not asked
> anyone for anything."

**Do:** scroll the right rail to **Suggested add-ons**. Click **Add to quote** on *On-site Setup Service*.

> "These come from co-purchase history, not a hardcoded list. Setup service is bought with this
> laptop most often. Adding it..."

**Do:** point at the margin figure as it ticks.

> "...margin goes up to nineteen point five five, because services carry a better margin than hardware."

**Do:** in the picker, switch to the **Subscriptions** tab and add **DealFlow Cloud Standard**, set quantity **10**.

> "And a subscription on the same order. One-time hardware and a recurring line together, which is
> where most quote-to-cash tools give up. Margin twenty point six eight, order four lakh sixty-five thousand."

### 3. It routes itself · Tab 1 → Tab 2 · 1:05–1:35

**Do:** click **Send for approval**. Let the toast land.

> "Routed to the sales manager. Blended risk one point nine points, which is inside the manager's
> three point limit, so finance is not involved. Those thresholds are configuration, not code."

**Do:** switch to **Tab 2, Meera**. Open the same quotation, go to **Approval & audit**.

**Do:** scroll the per-line policy table.

> "The manager sees exactly which line broke policy and by how much. Seventeen given, fifteen
> allowed, two points over."

**Do:** type a reason, click **Approve**.

> "Approved, with a reason, against her name."

### 4. Fulfilment splits itself · Tab 2 · 1:35–2:00

**Do:** click **Fulfillment**, then **Confirm order**.

**Do:** let the two split plans render. Point at each.

> "Nine laptops, and no single warehouse has nine. So it offers two plans. Two shipments from
> South Hub and Main, nine hundred and sixty rupees, ships complete. Or one shipment, five hundred
> and sixty, with one unit backordered. It shows the trade-off instead of deciding for you."

**Do:** click **Accept suggested split**.

> "Stock is decremented from both warehouses and two shipments exist."

### 5. Hybrid billing · Tab 2 · 2:00–2:15

**Do:** click **Billing**.

> "One invoice for the one-time lines, four lakh fifty-four thousand two hundred plus tax, posted.
> And separately, the subscription is scheduled for its next three cycles at eleven thousand each.
> Same order, billed two different ways, reconciled."

---

## Flow B — the customer negotiates · target 1:45

### 6. The customer's view · Tab 4 · 2:15–2:45

**Do:** switch to the private window with the portal link.

**Say as it loads:**

> "This is the customer. Different link, different login, different theme. They see prices and
> totals. No cost, no margin, no risk score, no audit trail."

**Do:** scroll the quotation slowly.

> "It reads like a document rather than a form."

**Do:** click **Ask / propose change** on *Scale Calibration Service*. Type a note, enter **18**, send.

> "They want eighteen percent on calibration. Services for gold are capped at ten."

**Do:** click **Confirm quotation** to show it blocked.

> "And they cannot simply confirm their way around it. Their requested terms are with our approvals team."

### 7. It re-enters approval by itself · Tab 5 Arjun · 2:45–3:20

**Do:** switch to Arjun's tab, open Q-2026-0104. The **Requested changes** panel is at the top.

> "The rep sees the request live, over server-sent events. No refresh."

**Do:** point at the red chip on the request.

> "Eight points over the ceiling."

**Do:** click **Accept 18%**.

**Do:** let the toast land, then point at the status.

> "That is the whole idea. Accepting a customer's counter changes the terms, so risk and routing
> run again from scratch, the earlier approval is voided, and it goes back into the chain. This
> time eight points over pulls finance in as well. Nobody triggered that."

### 8. Approve and close · Tabs 2, 3, 4 · 3:20–4:00

**Do:** Tab 2 Meera, approve. Then Tab 3 Vikram, approve.

> "Manager, then finance."

**Do:** back to Tab 4, the customer. Reload. Click **Confirm quotation**.

> "Confirmed, and the confetti is the only celebration in the app."

**Do:** Tab 3 Vikram, open the order's **Billing** tab, click **Record payment**, pay the full amount.

> "Payment recorded, invoice flips to paid."

---

## Close · 4:00–4:45

### 9. The audit trail

**Do:** on that quotation, scroll to the **Audit timeline** at the bottom.

> "Every step you just watched is here. Who, when, what and why. Including the automatic ones,
> which are logged against the system rather than a person, so an auto-approval is never mistaken
> for a human one."

### 10. It is configuration, not code

**Do:** go to **Backend → Discount policy**.

> "And none of those limits are hardcoded. This grid is what the engine reads. Change gold services
> from ten to twenty and the quote you just watched would never have needed approval at all."

**Do:** click **Deal health**.

> "The manager's view. Stalled deals, delivery slippage, and discount anomalies measured against
> each rep's own history. Arjun averages nine point four percent, this quote is at seventeen point
> three, so it is flagged."

### 11. Last line

> "Business rules in pure functions, a customer portal that is genuinely a separate system, an audit
> trail on every mutation, and it runs entirely on this laptop with no network calls. That is DealFlow360."

---

## Timing

| Section | Runs to |
|---|---|
| Flow A | 2:15 |
| Flow B | 4:00 |
| Close | 4:45 |

Fifteen seconds of headroom. If you are running long, cut section 10's backend grid — it is the
least essential and the easiest to describe in one sentence instead.

## If something goes wrong on camera

- **A number does not match this script** — the database has drifted. Stop, `npx prisma db seed`, start again.
- **The portal link 404s** — it expires after 72 hours and changes every reseed. Take the fresh one from the seed output.
- **The customer tab shows internal data** — you are not in a private window.
- **Approve is greyed out** — you are signed in as the rep who raised it. Nobody can approve their own quotation.
