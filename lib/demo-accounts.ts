// Single source of truth for seed logins and the login-screen hint list.
//
// Not "demo1234": that string sits in public breach corpora, so Chrome interrupts every
// sign-in with a "found in a data breach" warning — during a demo, on every login. This is
// still obviously a shared demo credential, it just is not one anybody has leaked.
export const DEMO_PASSWORD = "df360-demo-2026";

export const DEMO_ACCOUNTS = [
  { name: "Priya Sharma", email: "priya@dealflow.local", role: "SALES_REP", blurb: "Sales rep — builds quotes" },
  { name: "Arjun Mehta", email: "arjun@dealflow.local", role: "SALES_REP", blurb: "Sales rep — discounts generously" },
  { name: "Meera Iyer", email: "meera@dealflow.local", role: "SALES_MANAGER", blurb: "Approves step 1, deal health" },
  { name: "Vikram Rao", email: "vikram@dealflow.local", role: "FINANCE", blurb: "Approves step 2, fulfillment, billing" },
  { name: "Ananya Desai", email: "admin@dealflow.local", role: "ADMIN", blurb: "Backend configuration" },
] as const;
