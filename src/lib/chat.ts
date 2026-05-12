import { supabase } from "@/integrations/supabase/client";

/**
 * Get-or-create a conversation between buyer and seller for a given listing
 * (pre-purchase inquiry) or order (post-purchase). Idempotent.
 */
export async function ensureConversation(opts: {
  buyerId: string;
  sellerId: string;
  listingId?: string | null;
  orderId?: string | null;
  subject?: string;
}): Promise<string> {
  const { buyerId, sellerId, listingId = null, orderId = null, subject } = opts;
  if (buyerId === sellerId) throw new Error("Cannot start a conversation with yourself.");

  // Try existing
  let q = supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId);
  if (orderId) q = q.eq("order_id", orderId);
  else if (listingId) q = q.eq("listing_id", listingId).is("order_id", null);

  const { data: existing } = await q.maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      listing_id: listingId,
      order_id: orderId,
      subject: subject ?? null,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not start conversation.");
  return created.id;
}

export async function markConversationRead(conversationId: string, role: "buyer" | "seller") {
  const patch = role === "buyer" ? { buyer_unread: 0 } : { seller_unread: 0 };
  await supabase.from("conversations").update(patch).eq("id", conversationId);
  if (role === "buyer") {
    await supabase.from("messages").update({ read_by_buyer: true }).eq("conversation_id", conversationId).eq("read_by_buyer", false);
  } else {
    await supabase.from("messages").update({ read_by_seller: true }).eq("conversation_id", conversationId).eq("read_by_seller", false);
  }
}