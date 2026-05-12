import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/layout/SiteShell";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";
import { MessageSquare, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/messages")({
  component: MessagesLayout,
});

interface ConvRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  order_id: string | null;
  subject: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  buyer_unread: number;
  seller_unread: number;
}

interface PartyMap {
  [id: string]: { display_name: string | null; avatar_url: string | null };
}

function MessagesLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [parties, setParties] = useState<PartyMap>({});
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login", redirect: "/messages" } });
  }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    setListLoading(true);
    const { data } = await supabase
      .from("conversations")
      .select("id,buyer_id,seller_id,listing_id,order_id,subject,last_message_at,last_message_preview,buyer_unread,seller_unread")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    const rows = (data ?? []) as ConvRow[];
    setConvs(rows);
    // Fetch counterparty profiles
    const ids = Array.from(new Set(rows.flatMap((c) => [c.buyer_id, c.seller_id]).filter((id) => id !== user.id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
      const map: PartyMap = {};
      (profs ?? []).forEach((p) => { map[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
      setParties(map);
    }
    setListLoading(false);
  };

  useEffect(() => { void load(); }, [user]);

  // Realtime: refresh list when any of my conversations updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-conversations:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  if (!user) return <SiteShell><div className="px-6 py-32 text-center text-muted-foreground">Loading…</div></SiteShell>;

  return (
    <SiteShell>
      <div className="px-4 md:px-6 pt-10 pb-16 max-w-7xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-crimson mb-3">— Messages</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Inbox</h1>
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-crimson" /> Private buyer ↔ seller messaging. Admins may review for trust & safety.
        </div>

        <div className="mt-8 grid lg:grid-cols-[340px_1fr] gap-4">
          <aside className="glass rounded-2xl overflow-hidden h-fit max-h-[75vh] overflow-y-auto">
            {listLoading ? (
              <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />)}</div>
            ) : convs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <MessageSquare className="size-6 mx-auto mb-2 opacity-50" />
                No conversations yet.
              </div>
            ) : convs.map((c) => {
              const meIsBuyer = c.buyer_id === user.id;
              const otherId = meIsBuyer ? c.seller_id : c.buyer_id;
              const other = parties[otherId];
              const unread = meIsBuyer ? c.buyer_unread : c.seller_unread;
              return (
                <Link
                  key={c.id}
                  to="/messages/$conversationId"
                  params={{ conversationId: c.id }}
                  activeProps={{ className: "bg-surface-elevated" }}
                  className="block px-4 py-3 border-b border-border last:border-0 hover:bg-surface-elevated transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{other?.display_name ?? "User"}</p>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">{c.last_message_preview ?? c.subject ?? "Start a conversation"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-crimson">{meIsBuyer ? "Buyer" : "Seller"}</span>
                    {c.order_id && <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">· Order</span>}
                    {!c.order_id && c.listing_id && <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">· Inquiry</span>}
                    {unread > 0 && <span className="ml-auto bg-crimson text-foreground text-[10px] rounded-full px-2 py-0.5 font-bold">{unread}</span>}
                  </div>
                </Link>
              );
            })}
          </aside>
          <section className="glass rounded-2xl overflow-hidden">
            <Outlet />
          </section>
        </div>
      </div>
    </SiteShell>
  );
}