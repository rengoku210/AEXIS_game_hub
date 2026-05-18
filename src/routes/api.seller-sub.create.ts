import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertVerifiedUser, verifiedUserErrorResponse } from "@/lib/auth/server-verify";

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 699,
  elite: 1499,
  exclusive: 3499,
};

const PLAN_NAMES: Record<string, string> = {
  free: "HUXZAIN Seller — Starter",
  pro: "HUXZAIN Seller — Pro",
  elite: "HUXZAIN Seller — Elite",
  exclusive: "HUXZAIN Seller — Exclusive",
};

const createSubInput = z.object({
  plan_type: z.enum(["free", "pro", "elite", "exclusive"]),
});

export const Route = createFileRoute("/api/seller-sub/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getUser(token);

        if (claimsError || !claimsData.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        if (!assertVerifiedUser(claimsData.user)) {
          return verifiedUserErrorResponse();
        }

        const userId = claimsData.user.id;
        const body = await request.json();
        const parseResult = createSubInput.safeParse(body);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: "Invalid plan type" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const { plan_type } = parseResult.data;
        const amountInr = PLAN_PRICES[plan_type];

        // Free plan – activate immediately without Razorpay
        if (plan_type === "free") {
          const { error: activateErr } = await (supabaseAdmin as any).rpc("activate_seller_plan", {
            _user_id: userId,
            _plan_type: "free",
            _amount_inr: 0,
          });
          if (activateErr) {
            return new Response(JSON.stringify({ error: activateErr.message }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ activated: true, plan: "free" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
          return new Response(JSON.stringify({ error: "Payment gateway not configured." }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        // Get buyer profile for prefill
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name,phone")
          .eq("id", userId)
          .maybeSingle();

        const amountInPaise = amountInr * 100;
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: "INR",
            receipt: `seller_sub_${userId.slice(0, 8)}_${Date.now()}`,
            notes: {
              user_id: userId,
              plan_type,
              purpose: "seller_subscription",
            },
          }),
        });

        if (!rzpRes.ok) {
          const errText = await rzpRes.text();
          console.error("Razorpay sub order create failed:", rzpRes.status, errText);
          return new Response(JSON.stringify({ error: `Payment gateway error (${rzpRes.status}).` }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };

        return new Response(JSON.stringify({
          razorpayOrderId: rzpOrder.id,
          razorpayKeyId: keyId,
          amountInPaise,
          currency: "INR",
          planType: plan_type,
          planName: PLAN_NAMES[plan_type],
          buyerName: profile?.display_name ?? null,
          buyerEmail: claimsData.user.email ?? null,
        }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
