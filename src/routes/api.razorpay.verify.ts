import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertVerifiedUser, verifiedUserErrorResponse } from "@/lib/auth/server-verify";

const verifyInput = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const Route = createFileRoute("/api/razorpay/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const token = authHeader.replace("Bearer ", "");
        const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getUser(token);
        
        if (claimsError || !claimsData.user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        if (!assertVerifiedUser(claimsData.user)) {
          return verifiedUserErrorResponse();
        }

        const userId = claimsData.user.id;

        const body = await request.json();
        const parseResult = verifyInput.safeParse(body);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const data = parseResult.data;

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
            return new Response(JSON.stringify({ error: "Razorpay is not configured." }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const { createHmac, timingSafeEqual } = await import("crypto");
        const expected = createHmac("sha256", keySecret)
          .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
          .digest("hex");

        const a = Buffer.from(expected);
        const b = Buffer.from(data.razorpay_signature);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response(JSON.stringify({ error: "Payment signature verification failed." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }

        // Find the order
        const { data: orderRow } = await supabaseAdmin
          .from("orders")
          .select("id,buyer_id,status,payment_status")
          .eq("razorpay_order_id", data.razorpay_order_id)
          .maybeSingle();

        if (!orderRow) {
            return new Response(JSON.stringify({ error: "Order not found for this payment." }), { status: 404, headers: { "Content-Type": "application/json" } });
        }
        if (orderRow.buyer_id !== userId) {
            return new Response(JSON.stringify({ error: "This order does not belong to you." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }

        // Idempotent
        if (orderRow.payment_status !== "paid") {
          await supabaseAdmin
            .from("orders")
            .update({
              status: "paid",
              payment_status: "paid",
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature,
            })
            .eq("id", orderRow.id);
        }

        return new Response(JSON.stringify({ orderId: orderRow.id }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
