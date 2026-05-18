import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

/** Client-side route guard — redirects unauthenticated users to /auth. */
export function useRequireAuth(redirectPath?: string) {
  const { user, loading, isEmailVerified } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user || !isEmailVerified) {
      navigate({
        to: "/auth",
        search: {
          mode: user && !isEmailVerified ? "verify" : "login",
          email: user && !isEmailVerified ? (user.email ?? undefined) : undefined,
          redirect: redirectPath,
        },
      });
    }
  }, [user, loading, isEmailVerified, navigate, redirectPath]);

  return { user, loading, ready: !loading && !!user && isEmailVerified };
}
