import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ChatThread } from "@/components/chat/ChatThread";
import { Package, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/messages/$conversationId")({
  component: ConversationPage,
});

interface ConvCtx {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  order_id: string | null;
  subject: string | null;
}

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const [conv, setConv] = useState<ConvCtx | null>(null);
  const [other, setOther] = useState<{ display_name: string | null } | null>(null);
  const [orderNum, setOrderNum] = useState<string | null>(null);
  const [listingTitle, setListingTitle] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: c } = await supabase
        .from("conversations")
        .select("id,buyer_id,seller_id,listing_id,order_id,subject")
        .eq("id", conversationId)
        .maybeSingle();
      if (!c) return;
      setConv(c as ConvCtx);
      const otherId = c.buyer_id === user?.id ? c.seller_id : c.buyer_id;
      const [{ data: prof }, orderRes, listingRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", otherId).maybeSingle(),
        c.order_id ? supabase.from("orders").select("order_number,listing_title").eq("id", c.order_id).maybeSingle() : Promise.resolve({ data: null }),
        c.listing_id ? supabase.from("listings").select("title,slug").eq("id", c.listing_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setOther(prof);
      if (orderRes.data) {
        setOrderNum(orderRes.data.order_number);
        setListingTitle(orderRes.data.listing_title);
      } else if (listingRes.data) {
        setListingTitle(listingRes.data.title);
      }
    })();
  }, [conversationId, user]);

  if (!conv || !user) return <div className="p-8 text-center text-muted-foreground">Loading conversation…</div>;
  const role: "buyer" | "seller" = conv.buyer_id === user.id ? "buyer" : "seller";

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{other?.display_name ?? "User"}</p>
          {(orderNum || listingTitle) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Package className="size-3" />
              {orderNum ? `Order ${orderNum}` : "Inquiry"} · {listingTitle}
            </p>
          )}
        </div>
        {conv.order_id && (
          <Link to="/account/orders/$orderId" params={{ orderId: conv.order_id }} className="font-mono text-[10px] uppercase tracking-widest text-crimson hover:text-crimson-glow inline-flex items-center gap-1">
            View order <ExternalLink className="size-3" />
          </Link>
        )}
      </div>
      <ChatThread conversationId={conversationId} role={role} />
    </div>
  );
}