import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WordPressClient } from "@/lib/wordpress/client";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/admin/diagnostics")({
  component: DiagnosticsPage,
});

function DiagnosticsPage() {
  const [wpStatus, setWpStatus] = useState<"loading" | "ok" | "error">("loading");
  const [wpVersion, setWpVersion] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<"loading" | "ok" | "error">("loading");
  const [paymentStatus, setPaymentStatus] = useState<"loading" | "ok" | "error">("loading");
  const [logs, setLogs] = useState<{ time: string, message: string, type: "info" | "warn" | "error" }[]>([]);

  const addLog = (message: string, type: "info" | "warn" | "error" = "info") => {
    setLogs(prev => [{ time: new Date().toISOString(), message, type }, ...prev]);
  };

  useEffect(() => {
    const runDiagnostics = async () => {
      // 1. Check Supabase
      try {
        const { error } = await supabase.from("profiles").select("id").limit(1);
        if (error) throw error;
        setSupabaseStatus("ok");
        addLog("Supabase connection established.", "info");
      } catch (e) {
        setSupabaseStatus("error");
        addLog(`Supabase connection failed: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
      }

      // 2. Check WordPress API
      try {
        const cats = await WordPressClient.getCategories();
        if (cats && cats.length > 0) {
          setWpStatus("ok");
          setWpVersion("v2.0.0 (HUXZAIN Marketplace)");
          addLog("WordPress API is reachable and responding.", "info");
        } else {
          setWpStatus("error");
          addLog("WordPress API returned empty or failed. Fallback active.", "warn");
        }
      } catch (e) {
        setWpStatus("error");
        addLog(`WordPress connection failed: ${e instanceof Error ? e.message : "Unknown error"}`, "error");
      }

      // 3. Check Payments (Mock for client side, typically checked via Razorpay script load or test order)
      try {
        // Checking if Razorpay script is loadable or env vars are present
        if (import.meta.env.VITE_RAZORPAY_KEY_ID) {
          setPaymentStatus("ok");
          addLog("Razorpay configuration is present.", "info");
        } else {
          setPaymentStatus("error");
          addLog("Missing VITE_RAZORPAY_KEY_ID environment variable.", "error");
        }
      } catch (e) {
        setPaymentStatus("error");
        addLog("Payment system validation failed.", "error");
      }
    };

    void runDiagnostics();
  }, []);

  const StatusIcon = ({ status }: { status: "loading" | "ok" | "error" }) => {
    if (status === "loading") return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
    if (status === "ok") return <CheckCircle2 className="size-5 text-green-500" />;
    return <XCircle className="size-5 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Diagnostics</h1>
        <p className="text-muted-foreground">Real-time status of the hybrid architecture.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* WP Status */}
        <div className="glass rounded-xl p-6 border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">WordPress API</h3>
            <StatusIcon status={wpStatus} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Primary CMS & Catalog</p>
            {wpVersion && <p className="mt-2 font-mono text-xs">Plugin: {wpVersion}</p>}
          </div>
        </div>

        {/* Supabase Status */}
        <div className="glass rounded-xl p-6 border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Supabase</h3>
            <StatusIcon status={supabaseStatus} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Auth, Chat, Orders, & Fallback</p>
          </div>
        </div>

        {/* Payment Status */}
        <div className="glass rounded-xl p-6 border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Payment Gateway</h3>
            <StatusIcon status={paymentStatus} />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Razorpay Escrow System</p>
          </div>
        </div>
      </div>

      <div className="glass-strong rounded-xl border border-border overflow-hidden">
        <div className="bg-surface px-4 py-3 border-b border-border flex items-center gap-2">
          <AlertCircle className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Runtime Logs</h3>
        </div>
        <div className="p-4 bg-black/40 font-mono text-xs space-y-2 h-64 overflow-y-auto">
          {logs.map((log, i) => (
            <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-zinc-400'}`}>
              <span className="opacity-50 shrink-0">[{new Date(log.time).toLocaleTimeString()}]</span>
              <span>{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="text-muted-foreground italic">No logs yet...</div>}
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground font-mono text-center pt-4">
        Frontend Build Version: {import.meta.env.MODE === 'development' ? 'DEV' : 'PROD-1.0.0'}
      </div>
    </div>
  );
}
