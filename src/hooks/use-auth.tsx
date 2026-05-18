import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchValidatedSession, signOutEverywhere } from "@/lib/auth/api";
import { isEmailVerified } from "@/lib/auth/guards";

export type AppRole = "admin" | "seller" | "buyer";

interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  seller_status: "none" | "pending" | "approved" | "suspended" | "rejected";
  seller_plan: "none" | "free" | "pro" | "elite" | "exclusive";
  seller_verified: boolean;
  seller_subscription_status: "inactive" | "active" | "expired" | "cancelled";
  email_verified: boolean;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isEmailVerified: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

async function loadProfileAndRoles(userId: string) {
  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,bio,seller_status,seller_plan,seller_verified,seller_subscription_status,email_verified")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  return {
    profile: (profileRes.data as Profile | null) ?? null,
    roles: (rolesRes.data?.map((r) => r.role) ?? []) as AppRole[],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const hydrate = useCallback(
    async (validatedUser: User | null, validatedSession: Session | null) => {
      if (!validatedUser || !validatedSession) {
        clearAuthState();
        return;
      }

      setSession(validatedSession);
      setUser(validatedUser);
      const { profile: nextProfile, roles: nextRoles } = await loadProfileAndRoles(validatedUser.id);
      setProfile(nextProfile);
      setRoles(nextRoles);
    },
    [clearAuthState],
  );

  const syncFromServer = useCallback(async () => {
    const { user: validatedUser, session: validatedSession } = await fetchValidatedSession();
    await hydrate(validatedUser, validatedSession);
  }, [hydrate]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await syncFromServer();
      if (mounted) setLoading(false);
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAuthState();
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void syncFromServer();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [clearAuthState, syncFromServer]);

  const refresh = async () => {
    await syncFromServer();
  };

  const signOut = async () => {
    await signOutEverywhere();
    clearAuthState();
  };

  const verified = isEmailVerified(user) && (profile?.email_verified ?? true);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        isEmailVerified: verified,
        isAdmin: roles.includes("admin"),
        isSeller: roles.includes("seller"),
        signOut,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
