import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createOrderInput = z.object({
  listing_id: z.string().uuid(),
  buyer_notes: z.string().trim().max(1000).optional(),
});

export const Route = createFileRoute("/api/razorpay/create")({
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
        
        const userId = claimsData.user.id;

        const body = await request.json();
        const parseResult = createOrderInput.safeParse(body);
        if (!parseResult.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const data = parseResult.data;

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
          return new Response(JSON.stringify({ error: "Razorpay is not configured for this deployment." }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        // 1. Look up the listing
        const { data: listing, error: listingErr } = await supabaseAdmin
          .from("listings")
          .select("id,title,price_inr,seller_id,status")
          .eq("id", data.listing_id)
          .maybeSingle();

        if (listingErr) return new Response(JSON.stringify({ error: listingErr.message }), { status: 400, headers: { "Content-Type": "application/json" } });
        if (!listing) return new Response(JSON.stringify({ error: "Listing not found or no longer available." }), { status: 404, headers: { "Content-Type": "application/json" } });
        if (listing.status !== "active") return new Response(JSON.stringify({ error: "This listing is not available for purchase." }), { status: 400, headers: { "Content-Type": "application/json" } });
        if (listing.seller_id === userId) return new Response(JSON.stringify({ error: "You can't purchase your own listing." }), { status: 400, headers: { "Content-Type": "application/json" } });

        // 2. Get buyer profile for prefill
        const { data: buyer } = await supabaseAdmin
          .from("profiles")
          .select("display_name,phone")
          .eq("id", userId)
          .maybeSingle();
        const buyerEmail = claimsData.user.email ?? null;

        // 3. Insert internal order row
        const { data: orderRow, error: orderErr } = await supabaseAdmin
          .from("orders")
          .insert({
            buyer_id: userId,
            seller_id: listing.seller_id,
            listing_id: listing.id,
            listing_title: listing.title,
            amount_inr: listing.price_inr,
            commission_inr: 0,
            seller_payout_inr: listing.price_inr,
            status: "pending_payment",
            payment_status: "created",
            payment_method: "razorpay",
            buyer_notes: data.buyer_notes ?? null,
          })
          .select("id,order_number,amount_inr")
          .single();

        if (orderErr || !orderRow) return new Response(JSON.stringify({ error: orderErr?.message ?? "Failed to create order" }), { status: 500, headers: { "Content-Type": "application/json" } });

        // 4. Create Razorpay order via REST API
        const amountInPaise = orderRow.amount_inr * 100;
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
            receipt: orderRow.order_number,
            notes: {
              internal_order_id: orderRow.id,
              listing_id: listing.id,
              buyer_id: userId,
              seller_id: listing.seller_id,
            },
          }),
        });

        if (!rzpRes.ok) {
          const errText = await rzpRes.text();
          console.error("Razorpay order create failed:", rzpRes.status, errText);
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "failed", status: "cancelled" })
            .eq("id", orderRow.id);
          return new Response(JSON.stringify({ error: `Could not create Razorpay order (${rzpRes.status}). Check the store owner's API keys.` }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        const rzpOrder = (await rzpRes.json()) as { id: string; amount: number; currency: string };

        // 5. Save razorpay_order_id back
        await supabaseAdmin
          .from("orders")
          .update({ razorpay_order_id: rzpOrder.id })
          .eq("id", orderRow.id);

        return new Response(JSON.stringify({
          orderId: orderRow.id,
          orderNumber: orderRow.order_number,
          razorpayOrderId: rzpOrder.id,
          razorpayKeyId: keyId,
          amountInPaise,
          currency: "INR",
          listingTitle: listing.title,
          buyerName: buyer?.display_name ?? null,
          buyerEmail,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  }
});
