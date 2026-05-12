import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { useAuth } from "@/hooks/use-auth";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { ShieldCheck, Clock, CheckCircle2, XCircle, KeyRound, MessageSquare } from "lucide-react";
import { statusLabel, statusToneClass, TIMELINE_ORDER, type OrderStatus } from "@/lib/order-workflow";
import { ensureConversation } from "@/lib/chat";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/server/razorpay.functions";
import { openRazorpayCheckout } from "@/lib/razorpay-client";

export const Route = createFileRoute("/account/orders/$orderId")({
  component: OrderDetail,
});

interface Order {
  id: string; order_number: string; listing_title: string; listing_id: string;
  seller_id: string;
  amount_inr: number; commission_inr: number; seller_payout_inr: number;
  status: OrderStatus; payment_status: string;
  payment_method: string | null; payment_ref: string | null;
  razorpay_order_id: string | null; razorpay_payment_id: string | null;
  buyer_notes: string | null; created_at: string;
}

interface Handoff {
  id: string; payload_encrypted: string | null; payload_hint: string | null;
  attachment_url: string | null; released_at: string | null;
  buyer_acknowledged_at: string | null;
}

function OrderDetail() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrderFn = useServerFn(createRazorpayOrder);
  const verifyFn = useServerFn(verifyRazorpayPayment);
  const [order, setOrder] = useState<Order | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    setOrder(data as Order | null);
    if (data) {
      const { data: h } = await supabase
        .from("credential_handoffs")
        .select("id,payload_encrypted,payload_hint,attachment_url,released_at,buyer_acknowledged_at")
        .eq("order_id", data.id)
        .maybeSingle();
      setHandoff(h as Handoff | null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [orderId]);

  const payNow = async () => {
    if (!order || !user) return;
    setPaying(true);
    try {
      // Re-create a fresh Razorpay order against the same listing — keeps things
      // simple if the user abandoned the previous attempt.
      const fresh = await createOrderFn({
        data: { listing_id: order.listing_id, buyer_notes: order.buyer_notes ?? undefined },
      });
      await openRazorpayCheckout({
        key: fresh.razorpayKeyId,
        amount: fresh.amountInPaise,
        currency: fresh.currency,
        name: "Aexis",
        description: fresh.listingTitle,
        order_id: fresh.razorpayOrderId,
        prefill: {
          name: fresh.buyerName ?? undefined,
          email: fresh.buyerEmail ?? undefined,
        },
        theme: { color: "#7a0a14" },
        notes: { aexis_order_number: fresh.orderNumber },
        handler: async (resp) => {
          try { await verifyFn({ data: resp }); toast.success("Payment confirmed"); }
          catch { toast.info("Payment received. Confirming…"); }
          void load();
        },
        modal: {
          ondismiss: () => { setPaying(false); toast.info("Payment cancelled"); },
          confirm_close: true,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      setPaying(false);
    }
  };

  const confirmReceived = async () => {
    const { error } = await supabase.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success("Order completed");
    void load();
  };

  const openChat = async () => {
    if (!user || !order) return;
    try {
      const conv = await ensureConversation({
        buyerId: user.id, sellerId: order.seller_id, orderId: order.id, listingId: order.listing_id,
        subject: `Order ${order.order_number}`,
      });
      navigate({ to: "/messages/$conversationId", params: { conversationId: conv } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open chat"); }
  };

  if (loading) return <SiteShell><div className="px-6 py-32 text-center text-muted-foreground">Loading…</div></SiteShell>;
  if (!order) return <SiteShell><div className="px-6 py-32 text-center"><h1 className="text-3xl font-bold">Order not found</h1><Link to="/account" className="text-crimson mt-4 inline-block">Back to account</Link></div></SiteShell>;

  return (
    <SiteShell>
      <div className="px-6 pt-12 pb-24 max-w-3xl mx-auto">
        <Link to="/account" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">← Account</Link>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mt-6 mb-3">— Order {order.order_number}</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{order.listing_title}</h1>

        {/* Workflow timeline */}
        <div className="mt-6 glass rounded-2xl p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">— Progress</p>
          <ol className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {TIMELINE_ORDER.map((s) => {
              const idx = TIMELINE_ORDER.indexOf(order.status);
              const myIdx = TIMELINE_ORDER.indexOf(s);
              const reached = myIdx >= 0 && idx >= 0 && myIdx <= idx;
              return (
                <li key={s} className={`text-center p-2 rounded-lg border ${reached ? "border-crimson/40 bg-crimson/5 text-foreground" : "border-border text-muted-foreground"}`}>
                  <div className="font-mono text-[9px] uppercase tracking-widest">{statusLabel(s)}</div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-8 glass-strong rounded-2xl p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Amount</p>
              <p className="text-2xl font-bold">{formatINR(order.amount_inr)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Status</p>
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-mono uppercase tracking-widest border ${statusToneClass(order.status)}`}>{statusLabel(order.status)}</span>
            </div>
          </div>

          {order.buyer_notes && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Your notes</p>
              <p className="text-sm font-light text-muted-foreground">{order.buyer_notes}</p>
            </div>
          )}

          {order.status === "pending_payment" && user?.id && (
            <div className="border-t border-border pt-6">
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-crimson" /> Secure payment via Razorpay (UPI, Cards, Net Banking, Wallets).</div>
              <button onClick={payNow} disabled={paying} className="w-full bg-crimson text-foreground py-3.5 rounded-lg font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-50 transition-colors">
                {paying ? "Opening Razorpay…" : `Pay ${formatINR(order.amount_inr)}`}
              </button>
              <p className="mt-3 font-mono text-[9px] text-center uppercase tracking-widest text-muted-foreground">100% secure · Powered by Razorpay</p>
            </div>
          )}
          {order.status === "cancelled" && (
            <div className="border-t border-border pt-6 flex items-center gap-2 text-sm text-crimson"><XCircle className="size-4" /> This order was cancelled.</div>
          )}

          {order.status === "paid" && (
            <div className="border-t border-border pt-6 flex items-center gap-2 text-sm"><Clock className="size-4 text-yellow-500" /> Awaiting seller delivery</div>
          )}
          {order.status === "delivered" && (
            <div className="border-t border-border pt-6">
              <p className="text-sm mb-4 flex items-center gap-2"><CheckCircle2 className="size-4 text-green-500" /> Seller marked this as delivered. Confirm to release payment.</p>
              <button onClick={confirmReceived} className="w-full bg-crimson text-foreground py-3.5 rounded-lg font-semibold text-sm uppercase tracking-wider hover:bg-crimson-glow transition-colors">
                Confirm receipt & complete order
              </button>
            </div>
          )}
          {order.status === "completed" && (
            <div className="border-t border-border pt-6 flex items-center gap-2 text-sm text-green-500"><CheckCircle2 className="size-4" /> Order completed. Funds released to seller.</div>
          )}

          {/* Released credentials */}
          {handoff?.released_at && (
            <div className="border-t border-border pt-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-crimson mb-2 flex items-center gap-1.5"><KeyRound className="size-3" /> Released credentials</p>
              {handoff.payload_hint && <p className="text-sm font-semibold mb-2">{handoff.payload_hint}</p>}
              <pre className="p-3 bg-surface-elevated rounded-lg whitespace-pre-wrap break-words font-mono text-xs max-h-48 overflow-y-auto">{handoff.payload_encrypted}</pre>
              {handoff.attachment_url && (
                <a href={handoff.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-crimson hover:underline">Download attachment</a>
              )}
            </div>
          )}

          <div className="border-t border-border pt-6">
            <button onClick={() => void openChat()} className="w-full inline-flex items-center justify-center gap-2 border border-border rounded-lg py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-crimson/50">
              <MessageSquare className="size-4" /> Message seller
            </button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
