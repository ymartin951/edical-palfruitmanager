import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface UserRole {
  role: "ADMIN" | "AGENT";
  agentId: string | null;
}

interface UserRoleRow {
  role: "ADMIN" | "AGENT";
  agent_id: string | null;
}

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;

  /** Single-tenant: only admins are allowed into the app */
  isAdmin: boolean;

  /** If true, user must change password before accessing the app */
  mustChangePassword: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getUserRole(userId: string): Promise<UserRole | null> {
  const { data, error } = await supabase
    .from("user_agent_map")
    .select("role, agent_id")
    .eq("user_id", userId)
    .maybeSingle<UserRoleRow>();

  if (error || !data) return null;

  return { role: data.role, agentId: data.agent_id };
}

function readMustChangePassword(u: User | null): boolean {
  const meta = (u?.user_metadata as any) || {};
  return meta?.must_change_password === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const hydrateFromUser = async (u: User | null) => {
    setLoading(true);

    setUser(u);
    setMustChangePassword(readMustChangePassword(u));

    if (!u) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    const role = await getUserRole(u.id);
    setUserRole(role);
    setLoading(false);
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      hydrateFromUser(u);
    });

    // Auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      hydrateFromUser(u);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = useMemo(
    () => ({
      user,
      userRole,
      loading,
      mustChangePassword,
      isAdmin: userRole?.role === "ADMIN",
      signIn,
      signOut,
    }),
    [user, userRole, loading, mustChangePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
