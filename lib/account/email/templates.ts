import { brand } from "../../brand";
export type MailContent = { to: string; subject: string; text: string; html: string; context?: { owner: string; key: string } };
export type MailAppearance = { eyebrow?: string; preview?: string; code?: string; footer?: string; preferencesHref?: string };

// Email clients need inline colours. These mirror the blue/orange app tokens in
// globals.css, without external stylesheets, images or trackers.
export const emailTheme = {
  background: "#09090b", surface: "#18181b", border: "#303036",
  foreground: "#fafafa", muted: "#a1a1aa", blue: "#38bdf8", blueText: "#082f49", orange: "#fb923c",
} as const;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
function emailLink(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Email links must use HTTP or HTTPS");
  return escape(url.href);
}

export function mailTemplate(to: string, subject: string, paragraphs: string[], link?: { href: string; label: string }, appearance: MailAppearance = {}): MailContent {
  const c = emailTheme;
  if (appearance.code && !/^\d{6}$/.test(appearance.code)) throw new Error("Verification codes must have six digits");
  const footer = appearance.footer ?? `An account message from ${brand.productName}, ${brand.brandLine}. If you did not request this, you can ignore it or contact support.`;
  const preview = appearance.preview ?? paragraphs[0] ?? subject;
  const text = [`${brand.productName} ${brand.brandLine}`, subject, ...paragraphs, ...(appearance.code ? [`Your verification code is ${appearance.code}.`] : []), ...(link ? [`${link.label}: ${link.href}`] : []), footer, ...(appearance.preferencesHref ? [`Notification settings: ${appearance.preferencesHref}`] : []), `Support: ${brand.supportEmail}`].join("\n\n");
  const button = link ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px"><tr><td bgcolor="${c.blue}" style="border-radius:14px;text-align:center"><a href="${emailLink(link.href)}" style="display:inline-block;padding:15px 24px;border:1px solid ${c.blue};border-radius:14px;color:${c.blueText};font-size:15px;font-weight:700;text-decoration:none">${escape(link.label)} <span aria-hidden="true">&rarr;</span></a></td></tr></table>` : "";
  const code = appearance.code ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td align="center" bgcolor="${c.background}" style="padding:22px 10px;border:1px solid ${c.blue};border-radius:16px"><p style="margin:0 0 9px;font-size:11px;font-weight:700;letter-spacing:2px;color:${c.muted}">YOUR VERIFICATION CODE</p><p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:34px;font-weight:700;letter-spacing:7px;color:${c.blue}">${escape(appearance.code)}</p></td></tr></table>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(subject)}</title></head>
<body bgcolor="${c.background}" style="margin:0;padding:0;width:100%;background-color:${c.background};color:${c.foreground};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;color:${c.background};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escape(preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${c.background}"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px">
<tr><td style="padding:0 8px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td><span style="display:inline-block;padding:9px 18px;background-color:${c.blue};border-radius:24px;color:${c.blueText};font-size:21px;font-weight:800;letter-spacing:-.5px">${escape(brand.wordmark)}</span><small style="display:block;padding:8px 3px 0;color:${c.muted};font-size:11px">${escape(brand.brandLine)}</small></td><td align="right" style="font-size:11px;letter-spacing:2px;color:${c.muted}">YOUR WAY.<br>ONE STEP AT A TIME.</td></tr></table></td></tr>
<tr><td bgcolor="${c.surface}" style="padding:28px 24px;border:1px solid ${c.border};border-radius:24px">
<p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:2px;color:${c.orange}">${escape(appearance.eyebrow ?? "YOUR B1-WAY")}</p>
<h1 style="margin:0 0 22px;font-size:27px;line-height:1.25;font-weight:700;letter-spacing:-.6px;color:${c.foreground}">${escape(subject)}</h1>
${paragraphs.map(p => `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:${c.foreground}">${escape(p)}</p>`).join("")}${code}${button}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px"><tr><td style="border-top:1px solid ${c.border};padding-top:20px"><p style="margin:0;font-size:12px;line-height:1.7;color:${c.muted}">${escape(footer)}</p></td></tr></table>
</td></tr>
<tr><td style="padding:24px 8px 0"><p style="margin:0 0 10px;font-size:12px;line-height:1.7;color:${c.muted}">Need a hand? <a href="mailto:${escape(brand.supportEmail)}" style="color:${c.blue};text-decoration:underline">${escape(brand.supportEmail)}</a></p>${appearance.preferencesHref ? `<p style="margin:0 0 10px;font-size:12px"><a href="${emailLink(appearance.preferencesHref)}" style="color:${c.muted};text-decoration:underline">Manage notification preferences</a></p>` : ""}<p style="margin:0;font-size:11px;color:${c.muted}">${escape(brand.productName)} ${escape(brand.brandLine)} &middot; One useful step at a time.</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return { to, subject, text, html };
}

export const verificationMail = (email: string, code: string) => mailTemplate(email, "Verify your email", [
  "One small step before you get started. Enter this code in the app to confirm your email address.",
  "The code is valid for 10 minutes after it was requested. Use the latest message and never share your code.",
], undefined, { eyebrow: "EMAIL VERIFICATION", preview: `Your ${brand.productName} verification code is ready.`, code });

export const testMail = (email: string, appUrl: string) => mailTemplate(email, "One useful step at a time.", [
  `Here is the ${brand.productName} email preview you requested: the same calm dark surfaces, sky blue and orange highlights you know from the app.`,
  "Your real reminders can help you return to an upcoming event, a goal, your weekly review or your membership settings.",
  "This is a one-time style and delivery test. No event, workout, goal or subscription has been changed.",
], { href: new URL("/account", appUrl).href, label: "Open Account & Settings" }, {
  eyebrow: "YOUR REQUESTED TEST EMAIL", preview: `A first look at your ${brand.productName} email style.`,
  footer: "You received this one-time test because you requested it. It does not opt you into email reminders.",
});
