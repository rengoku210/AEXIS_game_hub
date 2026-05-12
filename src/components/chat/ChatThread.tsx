import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { markConversationRead } from "@/lib/chat";
import { toast } from "sonner";
import { Send, ShieldAlert, Lock } from "lucide-react";
import { timeAgo } from "@/lib/format";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_system: boolean;
  created_at: string;
}

interface Props {
  conversationId: string;
  /** "buyer" | "seller" | "admin" — controls UI affordances. */
  role: "buyer" | "seller" | "admin";
}

export function ChatThread({ conversationId, role }: Props) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load + mark read
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("messages")
        .select("id,conversation_id,sender_id,body,is_system,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((data ?? []) as Message[]);
        setLoading(false);
      }
      if (role !== "admin") await markConversationRead(conversationId, role);
    })();
    return () => { cancelled = true; };
  }, [conversationId, role]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });
          if (role !== "admin") void markConversationRead(conversationId, role);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, role]);

  // Autoscroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!user || role === "admin") return;
    const text = body.trim();
    if (!text) return;
    if (text.length > 4000) { toast.error("Message too long (max 4000 chars)."); return; }
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: text,
      is_system: false,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
  };

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-surface animate-pulse" />)}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-12 flex flex-col items-center gap-2">
            <Lock className="size-5 text-crimson" />
            <p>This conversation is private and end-to-end logged for trust & safety.</p>
            <p className="text-xs">Stay on the platform — never share Discord, Telegram, or external contacts.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const system = m.is_system;
            if (system) {
              return (
                <div key={m.id} className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground py-2">
                  {m.body}
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-crimson text-foreground" : "bg-surface-elevated text-foreground border border-border"}`}>
                  <p className="whitespace-pre-wrap leading-relaxed font-light">{m.body}</p>
                  <p className={`mt-1 text-[10px] font-mono opacity-70 ${mine ? "" : "text-muted-foreground"}`}>{timeAgo(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {role === "admin" ? (
        <div className="border-t border-border px-5 py-4 flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/5">
          <ShieldAlert className="size-4" /> Admin view — read-only. This visit is logged.
        </div>
      ) : (
        <div className="border-t border-border p-3 flex gap-2 items-end">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Type your message…"
            rows={2}
            maxLength={4000}
            className="flex-1 bg-surface-elevated border border-border rounded-xl p-3 text-sm font-light outline-none focus:border-crimson/50 resize-none"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !body.trim()}
            className="bg-crimson text-foreground p-3 rounded-xl hover:bg-crimson-glow disabled:opacity-50 transition-colors"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}