import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import { createHash } from "crypto";
import { passwordSchema } from "../../src/lib/auth/password-policy";

const otpPurposeSchema = z.enum(["signup", "login", "forgot_password", "seller_verification", "security"]);

const verifyInput = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().length(6).regex(/^\d{6}$/, "Must be a 6-digit code"),
  purpose: otpPurposeSchema.default("signup"),
  newPassword: passwordSchema.optional(),
});

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

async function findUserByEmail(email: string) {
  let page = 1;
  const perPage = 1000;

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  const parsed = verifyInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  const { email, otp, purpose, newPassword } = parsed.data;
  if (purpose === "forgot_password" && !newPassword) {
    return response.status(400).json({ error: "Enter a new password." });
  }

  const { data, error } = await (supabaseAdmin as any).rpc("verify_custom_otp", {
    _email: email,
    _otp_hash: hashOtp(otp),
    _purpose: purpose,
  } as any);

  if (error) {
    console.error("verify_custom_otp error:", error);
    return response.status(500).json({ error: "Verification failed. Please try again." });
  }

  const result = data as unknown as { ok: boolean; error?: string };
  if (!result.ok) {
    return response.status(400).json({ error: result.error ?? "Invalid code." });
  }

  let authUser;
  try {
    authUser = await findUserByEmail(email);
  } catch (listErr) {
    console.error("User lookup failed:", listErr);
    return response.status(500).json({ error: "User lookup failed." });
  }

  if (!authUser) {
    return response.status(404).json({ error: "Account not found. Please sign up first." });
  }

  if (purpose === "forgot_password") {
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
      email_confirm: true,
    });
    if (updateErr) {
      console.error("Password reset error:", updateErr);
      return response.status(500).json({ error: "Failed to reset password. Contact support." });
    }
    return response.status(200).json({ ok: true, passwordReset: true, requiresLogin: true });
  }

  if (!authUser.email_confirmed_at) {
    const { error: confirmErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      email_confirm: true,
    });
    if (confirmErr) {
      console.error("Email confirm error:", confirmErr);
      return response.status(500).json({ error: "Failed to verify account. Contact support." });
    }
  }

  const { data: sessionData, error: sessionErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (sessionErr || !sessionData) {
    return response.status(200).json({ ok: true, requiresLogin: true });
  }

  return response.status(200).json({
    ok: true,
    requiresLogin: false,
    actionLink: sessionData.properties?.action_link ?? null,
  });
}
