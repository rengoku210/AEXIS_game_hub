import type { User } from "@supabase/supabase-js";
import { isEmailVerified } from "./guards";

export function assertVerifiedUser(user: User | null): user is User {
  if (!user) return false;
  return isEmailVerified(user);
}

export function verifiedUserErrorResponse(): Response {
  return new Response(JSON.stringify({ error: "Email verification required" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
