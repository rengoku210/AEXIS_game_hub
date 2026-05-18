import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { escapeHtml, sendResendEmail, SUPPORT_EMAIL } from "@/lib/server/email";

const contactInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  subject: z.string().trim().min(4).max(160),
  category: z.enum(["general", "payment", "dispute", "technical", "account", "listing", "fraud"]).default("general"),
  message: z.string().trim().min(20).max(5000),
  website: z.string().max(0).optional(),
  startedAt: z.number().int().optional(),
});

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (msg: object, status = 200) =>
          new Response(JSON.stringify(msg), { status, headers: { "Content-Type": "application/json" } });

        const body = await request.json().catch(() => null);
        const parsed = contactInput.safeParse(body);
        if (!parsed.success) {
          return json({ error: parsed.error.issues[0]?.message ?? "Invalid contact request." }, 400);
        }

        const input = parsed.data;
        if (input.website) return json({ ok: true });
        if (input.startedAt && Date.now() - input.startedAt < 3000) {
          return json({ error: "Please wait a moment before sending." }, 429);
        }

        const ip = clientIp(request);
        const since = new Date(Date.now() - 60 * 60_000).toISOString();
        const { count } = await (supabaseAdmin as any)
          .from("contact_inquiries")
          .select("id", { count: "exact", head: true })
          .or(`email.eq.${input.email},ip_address.eq.${ip}`)
          .gte("created_at", since);

        if ((count ?? 0) >= 5) {
          return json({ error: "Too many support messages. Please try again later." }, 429);
        }

        const { error: insertErr } = await (supabaseAdmin as any).from("contact_inquiries").insert({
          name: input.name,
          email: input.email,
          subject: input.subject,
          category: input.category,
          message: input.message,
          ip_address: ip,
          user_agent: request.headers.get("user-agent"),
          status: "new",
        });

        if (insertErr) {
          console.error("[Contact] insert failed:", insertErr);
          return json({ error: "Support inbox is not configured. Please email support directly." }, 500);
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
          return json({ error: "Message saved, but email notification failed. Support can still review it." }, 502);
        }

        return json({ ok: true });
      },
    },
  },
});
