import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe, login as loginApi } from "../api/auth";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("HoneSight_token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("HoneSight_user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  async function login(email: string, password: string) {
    const data = await loginApi({ email, password });
    localStorage.setItem("HoneSight_token", data.access_token);
    localStorage.setItem("HoneSight_user", JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("HoneSight_token");
    localStorage.removeItem("HoneSight_user");
    setToken(null);
    setUser(null);
  }

  async function refreshMe() {
    if (!localStorage.getItem("HoneSight_token")) return;
    const current = await getMe();
    localStorage.setItem("HoneSight_user", JSON.stringify(current));
    setUser(current);
  }

  useEffect(() => {
    refreshMe().catch(() => logout());
  }, []);

  const value = useMemo(
    () => ({ user, token, login, logout, refreshMe, isAuthenticated: Boolean(token) }),
    [user, token],
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
