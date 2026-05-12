import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatINR, timeAgo } from "@/lib/format";
import { ChatThread } from "@/components/chat/ChatThread";
import { adminActionsFor, statusLabel, statusToneClass, TIMELINE_ORDER, type OrderStatus } from "@/lib/order-workflow";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { ShieldAlert, KeyRound, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders/$orderId")({
  component: AdminOrderDetail,
});

interface OrderRow {
  id: string; order_number: string; listing_title: string; listing_id: string;
  buyer_id: string; seller_id: string;
  amount_inr: number; commission_inr: number; seller_payout_inr: number;
  status: OrderStatus; payment_status: string;
  razorpay_order_id: string | null; razorpay_payment_id: string | null;
  buyer_notes: string | null; created_at: string; delivered_at: string | null;
}

interface Handoff {
  id: string; status: string; payload_hint: string | null; payload_encrypted: string | null;
  attachment_url: string | null; submitted_at: string; released_at: string | null;
  rejected_at: string | null; rejection_reason: string | null;
}

function AdminOrderDetail() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [conv, setConv] = useState<{ id: string } | null>(null);
  const [parties, setParties] = useState<{ buyer: string; seller: string }>({ buyer: "", seller: "" });
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const load = async () => {
    const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
    setOrder(o as OrderRow | null);
    if (o) {
      const [hRes, cRes, pRes] = await Promise.all([
        supabase.from("credential_handoffs").select("*").eq("order_id", o.id).maybeSingle(),
        supabase.from("conversations").select("id").eq("order_id", o.id).maybeSingle(),
        supabase.from("profiles").select("id,display_name").in("id", [o.buyer_id, o.seller_id]),
      ]);
      setHandoff(hRes.data as Handoff | null);
      setConv(cRes.data as { id: string } | null);
      const map: Record<string, string> = {};
      (pRes.data ?? []).forEach((p: { id: string; display_name: string | null }) => { map[p.id] = p.display_name ?? "User"; });
      setParties({ buyer: map[o.buyer_id] ?? "Buyer", seller: map[o.seller_id] ?? "Seller" });
    }
  };

  useEffect(() => { void load(); }, [orderId]);

  const logAudit = async (action: string, metadata: Record<string, unknown> = {}) => {
    if (!user) return;
    await supabase.from("admin_audit_log").insert({
      admin_id: user.id,
      action,
      entity_type: "order",
      entity_id: orderId,
      metadata: metadata as never,
    } as never);
  };

  const performAction = async (next: OrderStatus, reasonText?: string) => {
    if (!order || !user) return;
    setActing(true);
    const patch: TablesUpdate<"orders"> = { status: next };
    if (next === "completed") patch.completed_at = new Date().toISOString();
    if (next === "credential_released" && handoff && !handoff.released_at) {
      await supabase.from("credential_handoffs").update({
        released_at: new Date().toISOString(),
        released_by: user.id,
        status: "released",
      }).eq("id", handoff.id);
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    if (error) { toast.error(error.message); setActing(false); return; }
    await logAudit("status_change", { from: order.status, to: next, reason: reasonText ?? null });
    if (conv) {
      await supabase.from("admin_audit_log").insert({
        admin_id: user.id,
        action: "system_message",
        entity_type: "conversation",
        entity_id: conv.id,
        metadata: { status: next, reason: reasonText ?? null } as never,
      } as never);
    }
    toast.success(`Order moved to ${statusLabel(next)}`);
    setReason("");
    setActing(false);
    void load();
  };

  const openChatWithAudit = async () => {
    if (!conv) { toast.info("No conversation thread yet for this order."); return; }
    await logAudit("chat_read", { conversation_id: conv.id });
    setShowChat(true);
  };

  if (!order) return <div className="px-6 py-32 text-center text-muted-foreground">Loading…</div>;

  const actions = adminActionsFor(order.status, Boolean(handoff));

  return (
    <div className="space-y-6">
      <Link to="/admin/orders" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">← All orders</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-2">— Order {order.order_number}</p>
          <h1 className="text-2xl md:text-3xl font-bold">{order.listing_title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{parties.buyer}</span> → <span className="font-semibold text-foreground">{parties.seller}</span> · {timeAgo(order.created_at)}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest border ${statusToneClass(order.status)}`}>
          {statusLabel(order.status)}
        </span>
      </div>

      {/* Timeline */}
      <div className="glass rounded-2xl p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">— Workflow timeline</p>
        <ol className="grid grid-cols-2 md:grid-cols-6 gap-2">
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

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Payment */}
        <div className="glass rounded-2xl p-6 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">— Payment</p>
          <p className="text-2xl font-bold">{formatINR(order.amount_inr)}</p>
          <p className="text-xs text-muted-foreground">Status: <span className="text-foreground font-semibold">{order.payment_status}</span></p>
          {order.razorpay_payment_id && <p className="text-[10px] font-mono text-muted-foreground break-all">{order.razorpay_payment_id}</p>}
          <p className="text-xs text-muted-foreground">Commission: {formatINR(order.commission_inr)}</p>
          <p className="text-xs text-muted-foreground">Seller payout: {formatINR(order.seller_payout_inr)}</p>
        </div>

        {/* Credential handoff */}
        <div className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">— Credential handoff</p>
            <KeyRound className="size-4 text-crimson" />
          </div>
          {!handoff ? (
            <p className="text-sm text-muted-foreground">Seller has not submitted credentials yet.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Submitted {timeAgo(handoff.submitted_at)}</p>
              {handoff.payload_hint && <p className="text-sm font-semibold">{handoff.payload_hint}</p>}
              <details className="text-xs">
                <summary className="cursor-pointer text-crimson hover:text-crimson-glow font-mono uppercase tracking-widest text-[10px]">Reveal payload</summary>
                <pre className="mt-2 p-3 bg-surface-elevated rounded-lg whitespace-pre-wrap break-words font-mono text-[11px] max-h-48 overflow-y-auto">{handoff.payload_encrypted ?? "(no text payload)"}</pre>
              </details>
              {handoff.attachment_url && (
                <a href={handoff.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-crimson hover:underline inline-flex items-center gap-1">
                  Attachment <ExternalLink className="size-3" />
                </a>
              )}
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status: {handoff.status}</p>
              {handoff.released_at && <p className="text-[10px] font-mono text-green-400">Released {timeAgo(handoff.released_at)}</p>}
            </>
          )}
        </div>

        {/* Buyer notes */}
        <div className="glass rounded-2xl p-6 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">— Buyer notes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.buyer_notes ?? "—"}</p>
        </div>
      </div>

      {/* Admin actions */}
      <div className="glass-strong rounded-2xl p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-crimson mb-4">— Admin actions</p>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions available for this status.</p>
        ) : (
          <div className="space-y-3">
            {actions.some((a) => a.requiresReason) && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required for cancel/dispute/refund actions)…"
                rows={2}
                className="w-full bg-surface-elevated border border-border rounded-lg p-3 text-sm font-light outline-none focus:border-crimson/50 resize-none"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button
                  key={a.next + a.label}
                  onClick={() => {
                    if (a.requiresReason && !reason.trim()) { toast.error("Reason required."); return; }
                    void performAction(a.next, a.requiresReason ? reason.trim() : undefined);
                  }}
                  disabled={acting}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                    a.variant === "primary" ? "bg-crimson text-foreground hover:bg-crimson-glow" :
                    a.variant === "danger" ? "border border-crimson/50 text-crimson hover:bg-crimson/10" :
                    "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2">
            <MessageCircle className="size-3.5" /> — Buyer ↔ Seller conversation
          </p>
          {conv && !showChat && (
            <button onClick={() => void openChatWithAudit()} className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 inline-flex items-center gap-1">
              <ShieldAlert className="size-3" /> Reveal (logged)
            </button>
          )}
        </div>
        {!conv ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No chat thread for this order yet.</p>
        ) : !showChat ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Conversation hidden by default. Click "Reveal" — your read will be recorded in the audit log.</p>
        ) : (
          <ChatThread conversationId={conv.id} role="admin" />
        )}
      </div>
    </div>
  );
}