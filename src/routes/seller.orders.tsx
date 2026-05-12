import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatINR, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { statusLabel, statusToneClass, type OrderStatus } from "@/lib/order-workflow";
import { ensureConversation } from "@/lib/chat";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/seller/orders")({
  component: SellerOrders,
});

interface Order {
  id: string; order_number: string; listing_title: string; listing_id: string; buyer_id: string;
  amount_inr: number; commission_inr: number; seller_payout_inr: number;
  status: OrderStatus; created_at: string;
  handoff?: { status: string } | null;
}

function SellerOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [payload, setPayload] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id,order_number,listing_title,listing_id,buyer_id,amount_inr,commission_inr,seller_payout_inr,status,created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Order[];
    if (rows.length > 0) {
      const { data: handoffs } = await supabase
        .from("credential_handoffs")
        .select("order_id,status")
        .in("order_id", rows.map((r) => r.id));
      const map = new Map((handoffs ?? []).map((h: { order_id: string; status: string }) => [h.order_id, h]));
      rows.forEach((r) => { const h = map.get(r.id); r.handoff = h ? { status: h.status } : null; });
    }
    setOrders(rows);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user]);

  const markDelivered = async (id: string) => {
    const { error } = await supabase.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked as delivered"); void load(); }
  };

  const submitCredentials = async (order: Order) => {
    if (!user) return;
    if (!payload.trim()) { toast.error("Payload required."); return; }
    const { error } = await supabase.from("credential_handoffs").insert({
      order_id: order.id,
      seller_id: user.id,
      buyer_id: order.buyer_id,
      payload_encrypted: payload.trim(),
      payload_hint: hint.trim() || null,
      status: "pending_review",
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("orders").update({ status: "admin_review" }).eq("id", order.id);
    toast.success("Credentials submitted for admin review.");
    setUploadingFor(null); setHint(""); setPayload("");
    void load();
  };

  const openChat = async (order: Order) => {
    if (!user) return;
    try {
      const conv = await ensureConversation({
        buyerId: order.buyer_id, sellerId: user.id, orderId: order.id, listingId: order.listing_id,
        subject: `Order ${order.order_number}`,
      });
      navigate({ to: "/messages/$conversationId", params: { conversationId: conv } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open chat"); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Incoming orders</h2>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-surface animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold">{o.listing_title}</p>
                    <span className={`inline-flex px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest border ${statusToneClass(o.status)}`}>{statusLabel(o.status)}</span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">{o.order_number} · {timeAgo(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums">{formatINR(o.seller_payout_inr)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">of {formatINR(o.amount_inr)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={() => void openChat(o)} className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                  <MessageSquare className="size-3" /> Chat with buyer
                </button>
                {(o.status === "paid" && !o.handoff) && (
                  <button onClick={() => setUploadingFor(o.id)} className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest bg-crimson text-foreground hover:bg-crimson-glow inline-flex items-center gap-1.5">
                    <KeyRound className="size-3" /> Submit credentials
                  </button>
                )}
                {o.handoff && (
                  <span className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest border border-border text-muted-foreground">
                    Handoff: {o.handoff.status}
                  </span>
                )}
                {(o.status === "credential_released" || o.status === "in_progress") && (
                  <button onClick={() => markDelivered(o.id)} className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest border border-crimson/40 text-crimson hover:bg-crimson/10">
                    Mark delivered
                  </button>
                )}
              </div>
              {uploadingFor === o.id && (
                <div className="mt-4 border-t border-border pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Submit account credentials. Admin will verify before releasing to buyer.</p>
                  <input
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="Hint (e.g. 'Riot account login + recovery email')"
                    maxLength={200}
                    className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm font-light outline-none focus:border-crimson/50"
                  />
                  <textarea
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="Username, password, recovery codes, etc. Encrypted at rest."
                    rows={4}
                    maxLength={4000}
                    className="w-full bg-surface-elevated border border-border rounded-lg p-3 text-sm font-mono outline-none focus:border-crimson/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => void submitCredentials(o)} className="px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest bg-crimson text-foreground hover:bg-crimson-glow">Submit for review</button>
                    <button onClick={() => { setUploadingFor(null); setHint(""); setPayload(""); }} className="px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-6"><Link to="/messages" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-crimson">→ All conversations</Link></div>
    </div>
  );
}
