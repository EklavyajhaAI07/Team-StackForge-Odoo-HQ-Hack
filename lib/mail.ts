// Outbound email.
//
// The problem statement requires zero external network calls at runtime, and SMTP is an
// external call. So mail is OPT-IN: with no SMTP_USER/SMTP_PASS in the environment the app
// behaves exactly as it did before, offline and self-contained. Configure them and it sends.
//
// Sending never blocks or fails the action that triggered it. A registration that succeeded
// must not be reported as failed because a mail server was slow.
import nodemailer from "nodemailer";

export type MailResult = { sent: boolean; reason?: string };

const FROM_NAME = "DealFlow360";

function config() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) return null;
  return {
    user,
    pass,
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    owner: process.env.OWNER_EMAIL?.trim() || user,
    appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
  };
}

export function mailEnabled(): boolean {
  return config() !== null;
}

async function send(to: string, subject: string, html: string, text: string): Promise<MailResult> {
  const cfg = config();
  if (!cfg) return { sent: false, reason: "SMTP is not configured" };
  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transport.sendMail({ from: `"${FROM_NAME}" <${cfg.user}>`, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}

/* ─────────────────────────── templates ───────────────────────────
   Email clients strip <style> blocks and ignore flexbox and grid, so these are built the way
   email actually works: tables, inline styles, web-safe fonts, and a light ground. The app's
   dark theme does not survive Gmail's own dark mode, so the mail is light on purpose.        */

const INK = "#14171d";
const MUTED = "#6b7280";
const LINE = "#e6e8ec";
const BRAND = "#4257d4";
const MONEY = "#12805a";

function shell(preheader: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DealFlow360</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE};">
      <span style="font-size:17px;font-weight:700;color:${INK};letter-spacing:-0.3px;">DealFlow<span style="color:${BRAND};">360</span></span>
    </td></tr>
    ${body}
    <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};background:#fafbfc;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">
        Self-governing B2B sales operations. Built by Team StackForge for the Odoo Hackathon 2026.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const ROLE_COPY: Record<string, { label: string; can: string[] }> = {
  SALES_REP: {
    label: "Sales rep",
    can: [
      "Build quotations and apply discounts",
      "See live margin and risk as you price",
      "Send a quotation to a customer and answer their counters",
    ],
  },
  SALES_MANAGER: {
    label: "Sales manager",
    can: [
      "Clear the first approval step",
      "Set the discount ceilings every quotation is scored against",
      "Watch deal health for stalled deals and discount anomalies",
    ],
  },
  FINANCE: {
    label: "Finance",
    can: [
      "Clear the second approval step on higher-risk deals",
      "Decide how an order splits across warehouses",
      "Run billing, proration, credit notes and payments",
    ],
  },
  ADMIN: { label: "Admin", can: ["Configure everything the engines read at runtime"] },
};

export async function sendWelcomeEmail(user: { name: string; email: string; role: string }): Promise<MailResult> {
  const cfg = config();
  if (!cfg) return { sent: false, reason: "SMTP is not configured" };
  const role = ROLE_COPY[user.role] ?? { label: user.role, can: [] };
  const first = user.name.split(" ")[0];

  const bullets = role.can
    .map(
      (c) =>
        `<tr><td style="padding:0 0 9px 0;font-size:14px;line-height:1.5;color:${INK};">
           <span style="color:${MONEY};font-weight:700;">&#10003;</span>&nbsp;&nbsp;${c}</td></tr>`,
    )
    .join("");

  const html = shell(`Your DealFlow360 account is ready, ${first}.`, `
    <tr><td style="padding:28px 28px 0 28px;">
      <h1 style="margin:0 0 6px 0;font-size:21px;line-height:1.3;color:${INK};font-weight:700;">Welcome, ${first}.</h1>
      <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${MUTED};">
        Your account is ready. You are signed in as
        <strong style="color:${INK};">${role.label}</strong>, and that decides what you see and what you can sign off.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid ${LINE};border-radius:9px;background:#fbfcfd;margin:0 0 22px 0;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:0.4px;text-transform:uppercase;color:${MUTED};font-weight:700;">What you can do</p>
          <table role="presentation" cellpadding="0" cellspacing="0">${bullets}</table>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;">
        <tr><td style="border-radius:8px;background:${INK};">
          <a href="${cfg.appUrl}/quotations"
             style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
            Open the sales desk
          </a>
        </td></tr>
      </table>

      <p style="margin:0 0 6px 0;font-size:13px;line-height:1.6;color:${MUTED};">
        One thing worth knowing: nobody in DealFlow360 picks an approver. Every quotation is scored
        against the discount ceiling for that customer's tier, and the score decides who signs it off.
      </p>
      <p style="margin:0 0 26px 0;font-size:13px;line-height:1.6;color:${MUTED};">
        Signed in as <span style="color:${INK};">${user.email}</span>.
      </p>
    </td></tr>`);

  const text = `Welcome, ${first}.

Your DealFlow360 account is ready. You are signed in as ${role.label}, and that decides what you
see and what you can sign off.

What you can do:
${role.can.map((c) => `  - ${c}`).join("\n")}

Open the sales desk: ${cfg.appUrl}/quotations

Nobody in DealFlow360 picks an approver. Every quotation is scored against the discount ceiling
for that customer's tier, and the score decides who signs it off.

Signed in as ${user.email}.`;

  return send(user.email, `Welcome to DealFlow360, ${first}`, html, text);
}

export async function sendOwnerSignupNotice(user: {
  name: string;
  email: string;
  role: string;
  id: string;
}): Promise<MailResult> {
  const cfg = config();
  if (!cfg) return { sent: false, reason: "SMTP is not configured" };
  const role = ROLE_COPY[user.role] ?? { label: user.role, can: [] };
  const when = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const row = (k: string, v: string) =>
    `<tr>
       <td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:13px;color:${MUTED};width:110px;">${k}</td>
       <td style="padding:9px 0;border-bottom:1px solid ${LINE};font-size:13px;color:${INK};font-weight:600;">${v}</td>
     </tr>`;

  const html = shell(`${user.name} registered as ${role.label}.`, `
    <tr><td style="padding:28px 28px 0 28px;">
      <h1 style="margin:0 0 6px 0;font-size:19px;line-height:1.3;color:${INK};font-weight:700;">New account registered</h1>
      <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${MUTED};">
        Someone created an internal account on DealFlow360.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;">
        ${row("Name", user.name)}
        ${row("Email", user.email)}
        ${row("Role", role.label)}
        ${row("Registered", `${when} IST`)}
        ${row("User ID", `<span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;font-weight:400;">${user.id}</span>`)}
      </table>
      <p style="margin:0 0 26px 0;font-size:12px;line-height:1.6;color:${MUTED};">
        Self-registration cannot create an admin. Admin owns the configuration every engine reads,
        so only the three operating roles are open.
      </p>
    </td></tr>`);

  const text = `New DealFlow360 account registered.

Name:       ${user.name}
Email:      ${user.email}
Role:       ${role.label}
Registered: ${when} IST
User ID:    ${user.id}

Self-registration cannot create an admin.`;

  return send(cfg.owner, `New DealFlow360 signup — ${user.name} (${role.label})`, html, text);
}
