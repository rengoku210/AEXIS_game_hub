import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/components/layout/SiteShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchValidatedSession } from "@/lib/auth/api";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in — HUXZAIN" }] }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const authError = params.get("error_description") ?? params.get("error");

      if (authError) {
        if (!cancelled) {
          setError(authError);
          toast.error(authError);
        }
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) {
            setError(exchangeError.message);
            toast.error(exchangeError.message);
          }
          return;
        }
      }

      const { user, session } = await fetchValidatedSession();
      if (!user || !session) {
        if (!cancelled) {
          setError("Could not complete sign in. Try again.");
        }
        return;
      }

      if (!cancelled) {
        navigate({ to: "/account", replace: true });
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <SiteShell>
      <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center gap-4 px-6">
        {error ? (
          <>
            <p className="text-sm text-destructive text-center max-w-md">{error}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { mode: "login" } })}
              className="text-sm text-crimson font-semibold hover:underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <Loader2 className="size-8 animate-spin text-crimson" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Completing sign in…
            </p>
          </>
        )}
      </div>
    </SiteShell>
  );
}
