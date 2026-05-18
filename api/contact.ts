import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { escapeHtml, sendResendEmail, SUPPORT_EMAIL } from "../src/lib/server/email";

const contactInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  subject: z.string().trim().min(4).max(160),
  category: z.enum(["general", "payment", "dispute", "technical", "account", "listing", "fraud"]).default("general"),
  message: z.string().trim().min(20).max(5000),
  website: z.string().max(0).optional(),
  startedAt: z.number().int().optional(),
});

function clientIp(request: VercelRequest) {
  return (
    (request.headers["cf-connecting-ip"] as string) ??
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    (request.headers["x-real-ip"] as string) ??
    "unknown"
  );
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const parsed = contactInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid contact request." });
  }

  const input = parsed.data;
  if (input.website) return response.status(200).json({ ok: true });
  if (input.startedAt && Date.now() - input.startedAt < 3000) {
    return response.status(429).json({ error: "Please wait a moment before sending." });
  }

  const ip = clientIp(request);
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await (supabaseAdmin as any)
    .from("contact_inquiries")
    .select("id", { count: "exact", head: true })
    .or(`email.eq.${input.email},ip_address.eq.${ip}`)
    .gte("created_at", since);

  if ((count ?? 0) >= 5) {
    return response.status(429).json({ error: "Too many support messages. Please try again later." });
  }

  const { error: insertErr } = await (supabaseAdmin as any).from("contact_inquiries").insert({
    name: input.name,
    email: input.email,
    subject: input.subject,
    category: input.category,
    message: input.message,
    ip_address: ip,
    user_agent: request.headers["user-agent"],
    status: "new",
  });

  if (insertErr) {
    console.error("[Contact] insert failed:", insertErr);
    return response.status(500).json({ error: "Support inbox is not configured. Please email support directly." });
  }

  try {
    await sendResendEmail({
      to: SUPPORT_EMAIL,
      replyTo: input.email,
      subject: `HUXZAIN Support: ${input.subject}`,
      html: `
        <h2>New HUXZAIN support inquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
        <p><strong>Category:</strong> ${escapeHtml(input.category)}</p>
        <p><strong>IP:</strong> ${escapeHtml(ip)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>
      `,
    });
  } catch (err) {
    console.error("[Contact] email failed:", err);
    return response.status(502).json({ error: "Message saved, but email notification failed. Support can still review it." });
  }

  return response.status(200).json({ ok: true });
}
