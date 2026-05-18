const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const SUPPORT_EMAIL = "support@huxzain.shop";
export const SUPPORT_WHATSAPP = "+91 80996 41606";
export const SUPPORT_WHATSAPP_URL = "https://wa.me/918099641606";
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@huxzain.shop";

interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendResendEmail(input: SendEmailInput) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `HUXZAIN <${FROM_EMAIL}>`,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo,
    }),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    const isDev = process.env.NODE_ENV !== "production";
    throw new Error(isDev ? `Resend ${res.status}: ${details}` : `Email delivery failed (${res.status})`);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
