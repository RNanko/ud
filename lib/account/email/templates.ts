export type MailContent = { to: string; subject: string; text: string; html: string; context?: { owner: string; key: string } };
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function mailTemplate(to: string, subject: string, paragraphs: string[], link?: { href: string; label: string }): MailContent {
  const text = [...paragraphs, ...(link ? [`${link.label}: ${link.href}`] : []), "Support: support@b1-way.pl"].join("\n\n");
  const html = `<html lang="en"><body style="font-family:Arial,sans-serif;line-height:1.6;color:#17212b"><h1 style="font-size:20px;color:#0284c7">B1-Way</h1><h2 style="font-size:18px">${escape(subject)}</h2>${paragraphs.map(p => `<p>${escape(p)}</p>`).join("")}${link ? `<p><a href="${escape(link.href)}" style="color:#0284c7">${escape(link.label)}</a></p>` : ""}<p>Support: <a href="mailto:support@b1-way.pl">support@b1-way.pl</a></p></body></html>`;
  return { to, subject, text, html };
}
export const verificationMail = (email: string, code: string) => mailTemplate(email, "Your B1-Way verification code", [`Your verification code is ${code}.`, "It expires in 10 minutes. Use the latest message. Do not share this code.", "If you did not request this, you can ignore this message."]);
