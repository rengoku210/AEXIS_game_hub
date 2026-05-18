import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  MessageSquare, Flag, Lock, Search, Filter,
  ShieldAlert, CheckCircle, XCircle, Eye, RefreshCw,
  User, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/moderation")({
  component: ModerationPanel,
});

interface ConvReport {
  id: string;
  conversation_id: string;
  reporter_id: string;
  report_reason: string;
  report_detail: string | null;
  status: string;
  created_at: string;
  reporter?: { username: string | null; display_name: string | null };
  conversation?: {
    buyer_id: string; seller_id: string; subject: string | null;
    buyer?: { username: string | null };
    seller?: { username: string | null };
  };
}

interface ConvMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: { username: string | null; display_name: string | null };
}

interface AccountLock {
  id: string;
  user_id: string;
  reason: string;
  lock_type: string;
  locked_until: string | null;
  unlocked_at: string | null;
  created_at: string;
  profile?: { username: string | null; display_name: string | null; email?: string };
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  under_review: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-400 border-green-500/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

function fmt(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function ModerationPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"reports" | "chats" | "locks">("reports");
  const [reports, setReports] = useState<ConvReport[]>([]);
  const [locks, setLocks] = useState<AccountLock[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat viewer state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  // Search / filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Lock form
  const [lockUserId, setLockUserId] = useState("");
  const [lockReason, setLockReason] = useState("");
  const [lockType, setLockType] = useState<"chat" | "account" | "listings">("chat");
  const [lockUntil, setLockUntil] = useState("");
  const [lockLoading, setLockLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("conversation_reports")
      .select(`
        id, conversation_id, reporter_id, report_reason, report_detail, status, created_at,
        reporter:profiles!conversation_reports_reporter_id_fkey(username, display_name),
        conversation:conversations!conversation_reports_conversation_id_fkey(
          buyer_id, seller_id, subject,
          buyer:profiles!conversations_buyer_id_fkey(username),
          seller:profiles!conversations_seller_id_fkey(username)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);
    setReports((data ?? []) as unknown as ConvReport[]);
    setLoading(false);
  }, []);

  const loadLocks = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("account_locks")
      .select("id, user_id, reason, lock_type, locked_until, unlocked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setLocks((data ?? []) as unknown as AccountLock[]);
  }, []);

  useEffect(() => {
    void loadReports();
    void loadLocks();
  }, [loadReports, loadLocks]);

  const loadMessages = async (convId: string) => {
    setSelectedConvId(convId);
    setMsgLoading(true);
    const { data } = await supabase
      .from("messages")
      .select(`
        id, sender_id, body, created_at,
        sender:profiles!messages_sender_id_fkey(username, display_name)
      `)
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data ?? []) as unknown as ConvMessage[]);
    setMsgLoading(false);
  };

  const updateReportStatus = async (reportId: string, status: string) => {
    const { error } = await (supabase as any)
      .from("conversation_reports")
      .update({ status, resolved_by: user?.id, resolved_at: new Date().toISOString() })
      .eq("id", reportId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Report marked as ${status}`);
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status } : r));
  };

  const submitLock = async () => {
    if (!lockUserId.trim() || !lockReason.trim()) {
      toast.error("User ID and reason are required"); return;
    }
    setLockLoading(true);
    const { error } = await (supabase as any).from("account_locks").upsert({
      user_id: lockUserId.trim(),
      locked_by: user!.id,
      reason: lockReason.trim(),
      lock_type: lockType,
      locked_until: lockUntil || null,
    }, { onConflict: "user_id" });
    setLockLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account lock applied");
    setLockUserId(""); setLockReason(""); setLockUntil("");
    void loadLocks();
  };

  const removeLock = async (lockId: string) => {
    const { error } = await (supabase as any)
      .from("account_locks")
      .update({ unlocked_at: new Date().toISOString(), unlocked_by: user?.id })
      .eq("id", lockId);
    if (error) { toast.error(error.message); return; }
    toast.success("Lock removed");
    void loadLocks();
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || r.report_reason.includes(q) || (r.report_detail ?? "").toLowerCase().includes(q)
      || (r.conversation?.buyer?.username ?? "").toLowerCase().includes(q)
      || (r.conversation?.seller?.username ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="size-6 text-crimson" /> Chat Moderation
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Review reported conversations, inspect messages, and lock accounts. All actions are logged in the HUXZAIN audit trail.
          </p>
        </div>
        <button onClick={() => { void loadReports(); void loadLocks(); }}
          className="flex items-center gap-1.5 text-xs border border-border px-3 py-2 rounded-lg hover:bg-surface-elevated transition-colors">
          <RefreshCw className="size-3" /> Refresh
        </button>
      </div>

      {/* Tab nav */}
      <nav className="flex gap-1 border-b border-border">
        {[
          { id: "reports", label: `Reports (${reports.filter(r => r.status === "pending").length})`, Icon: Flag },
          { id: "chats", label: "Chat Viewer", Icon: MessageSquare },
          { id: "locks", label: `Locks (${locks.filter(l => !l.unlocked_at).length})`, Icon: Lock },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
              tab === id ? "border-crimson text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="size-3.5" />{label}
          </button>
        ))}
      </nav>

      {/* ── REPORTS TAB ─────────────────────────────────────────── */}
      {tab === "reports" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reason, user…"
                className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm outline-none focus:border-crimson/50 transition-colors" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-surface animate-pulse" />)}</div>
          ) : filteredReports.length === 0 ? (
            <div className="glass rounded-xl py-12 text-center text-muted-foreground">
              No reports found.
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden divide-y divide-border">
              {filteredReports.map((r) => (
                <div key={r.id} className="p-4 hover:bg-surface-elevated transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest ${STATUS_BADGE[r.status] ?? STATUS_BADGE.dismissed}`}>
                          {r.status.replace("_", " ")}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-crimson">
                          {r.report_reason}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fmt(r.created_at)}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium">
                        Buyer: <span className="text-muted-foreground">{r.conversation?.buyer?.username ?? "?"}</span>
                        {" · "}Seller: <span className="text-muted-foreground">{r.conversation?.seller?.username ?? "?"}</span>
                      </p>
                      {r.report_detail && (
                        <p className="mt-1 text-sm text-muted-foreground truncate max-w-xl">{r.report_detail}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setTab("chats"); void loadMessages(r.conversation_id); }}
                        className="flex items-center gap-1 text-xs border border-border px-2.5 py-1.5 rounded-lg hover:bg-surface transition-colors">
                        <Eye className="size-3" /> View Chat
                      </button>
                      {r.status === "pending" && (<>
                        <button onClick={() => updateReportStatus(r.id, "under_review")}
                          className="flex items-center gap-1 text-xs border border-blue-500/30 text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors">
                          <Flag className="size-3" /> Review
                        </button>
                        <button onClick={() => updateReportStatus(r.id, "dismissed")}
                          className="flex items-center gap-1 text-xs border border-border text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-surface transition-colors">
                          <XCircle className="size-3" /> Dismiss
                        </button>
                      </>)}
                      {r.status === "under_review" && (
                        <button onClick={() => updateReportStatus(r.id, "resolved")}
                          className="flex items-center gap-1 text-xs border border-green-500/30 text-green-400 px-2.5 py-1.5 rounded-lg hover:bg-green-500/10 transition-colors">
                          <CheckCircle className="size-3" /> Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CHAT VIEWER TAB ─────────────────────────────────────── */}
      {tab === "chats" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input value={selectedConvId ?? ""} onChange={(e) => setSelectedConvId(e.target.value)}
              placeholder="Paste conversation UUID…"
              className="flex-1 bg-surface border border-border rounded-lg px-4 py-2 text-sm outline-none focus:border-crimson/50 font-mono transition-colors" />
            <button onClick={() => selectedConvId && loadMessages(selectedConvId)}
              disabled={!selectedConvId || msgLoading}
              className="bg-crimson px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-crimson-glow disabled:opacity-50 transition-colors">
              Load
            </button>
          </div>

          {msgLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-lg bg-surface animate-pulse" />)}</div>
          ) : messages.length === 0 ? (
            <div className="glass rounded-xl py-12 text-center text-muted-foreground">
              {selectedConvId ? "No messages found for this conversation." : "Select a report and click 'View Chat', or enter a conversation ID above."}
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="bg-surface-elevated border-b border-border px-5 py-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {messages.length} messages
                </span>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{selectedConvId}</span>
              </div>
              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <div className="size-7 rounded-full bg-oxblood flex items-center justify-center text-xs font-bold shrink-0">
                      {(msg.sender?.display_name ?? msg.sender?.username ?? "?")[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">
                          {msg.sender?.display_name ?? msg.sender?.username ?? msg.sender_id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{fmt(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground bg-surface rounded-lg px-3 py-2 break-words">{msg.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOCKS TAB ───────────────────────────────────────────── */}
      {tab === "locks" && (
        <div className="space-y-6">
          {/* Lock creation form */}
          <div className="glass-strong rounded-2xl p-6 border border-border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lock className="size-4 text-crimson" /> Apply Account Lock
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">User ID (UUID)</label>
                <input value={lockUserId} onChange={(e) => setLockUserId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-…"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-crimson/50 font-mono transition-colors" />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Lock Type</label>
                <select value={lockType} onChange={(e) => setLockType(e.target.value as any)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="chat">Chat Only</option>
                  <option value="listings">Listings Only</option>
                  <option value="account">Full Account</option>
                </select>
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Reason</label>
                <input value={lockReason} onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Suspected scam / investigation…"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-crimson/50 transition-colors" />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Locked Until (optional)</label>
                <input type="datetime-local" value={lockUntil} onChange={(e) => setLockUntil(e.target.value)}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-crimson/50 transition-colors" />
              </div>
            </div>
            <button onClick={submitLock} disabled={lockLoading}
              className="mt-4 bg-crimson px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-crimson-glow disabled:opacity-50 transition-colors flex items-center gap-2">
              <Lock className="size-3.5" />
              {lockLoading ? "Applying…" : "Apply Lock"}
            </button>
          </div>

          {/* Active locks */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-400" /> Active Locks
            </h3>
            {locks.filter(l => !l.unlocked_at).length === 0 ? (
              <div className="glass rounded-xl py-8 text-center text-muted-foreground text-sm">No active locks.</div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden divide-y divide-border">
                {locks.filter(l => !l.unlocked_at).map((lock) => (
                  <div key={lock.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-muted-foreground" />
                        <span className="font-mono text-xs text-muted-foreground truncate">{lock.user_id}</span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest ${
                          lock.lock_type === "account"
                            ? "bg-crimson/10 border-crimson/30 text-crimson"
                            : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        }`}>{lock.lock_type}</span>
                      </div>
                      <p className="text-sm mt-1">{lock.reason}</p>
                      {lock.locked_until && (
                        <p className="text-xs text-muted-foreground mt-0.5">Until: {fmt(lock.locked_until)}</p>
                      )}
                    </div>
                    <button onClick={() => removeLock(lock.id)}
                      className="flex items-center gap-1 text-xs border border-green-500/30 text-green-400 px-2.5 py-1.5 rounded-lg hover:bg-green-500/10 transition-colors shrink-0">
                      <CheckCircle className="size-3" /> Unlock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
