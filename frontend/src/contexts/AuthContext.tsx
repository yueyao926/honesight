import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login as loginApi, logout as logoutApi } from "../api/auth";
import {
  clearLegacyStoredAuth,
  hydrateAuthSessionFromStorage,
  refreshAuthSession,
  setAuthSession,
  subscribeToAuthSession,
  updateAuthUser,
  type AuthSession,
} from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => subscribeToAuthSession(setSession), []);

  useEffect(() => {
    let active = true;
    clearLegacyStoredAuth();
    const stored = hydrateAuthSessionFromStorage();
    if (stored) {
      setAuthSession(stored);
      setIsLoading(false);
    }
    refreshAuthSession()
      .catch(() => null)
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const nextSession = await loginApi({ email, password });
    setAuthSession(nextSession);
  }

  async function logout() {
    await logoutApi();
    setAuthSession(null);
  }

  async function refreshMe() {
    if (!session) return;
    const current = await getMe();
    updateAuthUser(current);
  }

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.access_token ?? null,
      login,
      logout,
      refreshMe,
      isAuthenticated: Boolean(session),
      isLoading,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
