import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { createHash, randomInt } from "crypto";
import { sendResendEmail, SUPPORT_EMAIL } from "../../src/lib/server/email";

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES ?? "5");
const RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? "60");
const MAX_RESENDS_PER_HOUR = Number(process.env.OTP_MAX_SENDS_PER_HOUR ?? "5");

const otpPurposeSchema = z.enum(["signup", "login", "forgot_password", "seller_verification", "security"]);

const sendInput = z.object({
  email: z.string().email().toLowerCase().trim(),
  purpose: otpPurposeSchema.default("signup"),
});

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

function purposeCopy(purpose: z.infer<typeof otpPurposeSchema>) {
  switch (purpose) {
    case "forgot_password":
      return {
        subject: "HUXZAIN Password Reset Code",
        title: "Reset your password",
        body: "Use this code to reset your HUXZAIN password.",
      };
    case "seller_verification":
      return {
        subject: "HUXZAIN Seller Verification Code",
        title: "Verify your seller action",
        body: "Use this code to continue your seller verification.",
      };
    case "security":
      return {
        subject: "HUXZAIN Security Verification Code",
        title: "Security verification",
        body: "Use this code to confirm this security-sensitive action.",
      };
    case "login":
      return {
        subject: "HUXZAIN Login Verification Code",
        title: "Verify your login",
        body: "Use this code to finish signing in to HUXZAIN.",
      };
    default:
      return {
        subject: "HUXZAIN Verification Code",
        title: "Verify your email address",
        body: "Use this code to complete your HUXZAIN account verification.",
      };
  }
}

function otpEmailHtml(otp: string, expiresInMin: number, purpose: z.infer<typeof otpPurposeSchema>) {
  const copy = purposeCopy(purpose);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${copy.subject}</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:Arial,sans-serif;color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;max-width:540px;width:100%;">
        <tr>
          <td style="background:#120b0b;padding:28px 32px;border-bottom:1px solid #1f1f1f;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#dc2626;margin-right:8px;"></span>
            <span style="font-size:18px;font-weight:700;letter-spacing:0.05em;color:#f5f5f5;">HUXZAIN</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 30px;">
            <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.22em;color:#dc2626;font-family:monospace;">Security Code</p>
            <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#f5f5f5;line-height:1.2;">${copy.title}</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#aaa;">
              ${copy.body} This code expires in <strong style="color:#f5f5f5;">${expiresInMin} minutes</strong>.
            </p>
            <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#777;font-family:monospace;">Your verification code</p>
              <p style="margin:0;font-size:44px;font-weight:700;letter-spacing:0.22em;color:#f5f5f5;font-family:monospace;">${otp}</p>
            </div>
            <div style="background:#1a0d0d;border:1px solid #3a1010;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#d18b8b;line-height:1.5;">
                HUXZAIN staff will never ask for this code. If you did not request it, ignore this email.
              </p>
            </div>
            <p style="margin:0;font-size:13px;color:#777;line-height:1.6;">
              Need help? Contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#dc2626;text-decoration:none;">${SUPPORT_EMAIL}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#0a0a0a;border-top:1px solid #1f1f1f;padding:18px 32px;">
            <p style="margin:0;font-size:11px;color:#555;font-family:monospace;text-transform:uppercase;letter-spacing:0.1em;">
              2026 HUXZAIN Digital Marketplace - Secured Platform Protocol v2.0
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>\`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const parsed = sendInput.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid verification request." });

  const { email, purpose } = parsed.data;

  const { data: existingOtp, error: otpQueryErr } = await (supabaseAdmin as any)
    .from("email_otps")
    .select("last_resent_at,resend_count,created_at")
    .eq("email", email)
    .eq("purpose", purpose)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (otpQueryErr && otpQueryErr.code === "42P01") {
    console.error("[OTP] email_otps table not found");
    return response.status(500).json({ error: "Server verification storage is not configured." });
  }

  if (existingOtp) {
    const lastSent = new Date(existingOtp.last_resent_at ?? existingOtp.created_at);
    const secondsSinceLast = (Date.now() - lastSent.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
      return response.status(429).json({ error: \`Please wait \${wait}s before requesting another code.\`, cooldown: wait });
    }
  }

  const { count } = await (supabaseAdmin as any)
    .from("email_otps")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .eq("purpose", purpose)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());

  if ((count ?? 0) >= MAX_RESENDS_PER_HOUR) {
    return response.status(429).json({ error: "Too many verification requests. Please try again in an hour." });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000).toISOString();

  await (supabaseAdmin as any)
    .from("email_otps")
    .update({ used: true })
    .eq("email", email)
    .eq("purpose", purpose)
    .eq("used", false);

  const ip = (request.headers["cf-connecting-ip"] as string) ??
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    (request.headers["x-real-ip"] as string);

  const { error: insertErr } = await (supabaseAdmin as any).from("email_otps").insert({
    email,
    purpose,
    otp_hash: hashOtp(otp),
    expires_at: expiresAt,
    last_resent_at: new Date().toISOString(),
    ip_address: ip,
    user_agent: request.headers["user-agent"],
  });

  if (insertErr) {
    console.error("[OTP] DB insert error:", insertErr);
    return response.status(500).json({ error: "Failed to generate verification code." });
  }

  try {
    await sendResendEmail({
      to: email,
      subject: purposeCopy(purpose).subject,
      html: otpEmailHtml(otp, OTP_EXPIRY_MINUTES, purpose),
    });
  } catch (err: any) {
    console.error("[OTP] Resend delivery error:", err?.message);
    await (supabaseAdmin as any)
      .from("email_otps")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("otp_hash", hashOtp(otp));
    const isDev = process.env.NODE_ENV !== "production";
    return response.status(502).json(
      { error: isDev ? \`Email send failed: \${err?.message}\` : "Failed to send verification email. Please try again." }
    );
  }

  return response.status(200).json({ ok: true, expiresIn: OTP_EXPIRY_MINUTES * 60, cooldown: RESEND_COOLDOWN_SECONDS });
}
