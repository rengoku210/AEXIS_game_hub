import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertVerifiedUser, verifiedUserErrorResponse } from "@/lib/auth/server-verify";

const verifySubInput = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  plan_type: z.enum(["pro", "elite", "exclusive"]),
  amount_inr: z.number().int().positive(),
});

export const Route = createFileRoute("/api/seller-sub/verify")({
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
        const parseResult = verifySubInput.safeParse(body);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const data = parseResult.data;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
          return new Response(JSON.stringify({ error: "Razorpay is not configured." }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        // Verify signature
        const { createHmac, timingSafeEqual } = await import("crypto");
        const expected = createHmac("sha256", keySecret)
          .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
          .digest("hex");

        const a = Buffer.from(expected);
        const b = Buffer.from(data.razorpay_signature);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Payment signature verification failed." }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        // Activate plan via DB function
        const { data: subId, error: activateErr } = await (supabaseAdmin as any).rpc("activate_seller_plan", {
          _user_id: userId,
          _plan_type: data.plan_type,
          _razorpay_order_id: data.razorpay_order_id,
          _razorpay_payment_id: data.razorpay_payment_id,
          _amount_inr: data.amount_inr,
        });

        if (activateErr) {
          console.error("activate_seller_plan error:", activateErr);
          return new Response(JSON.stringify({ error: activateErr.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          activated: true,
          subscriptionId: subId,
          plan: data.plan_type,
        }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
