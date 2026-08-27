import type { User } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const SESSION_REQUEST_HEADER = "LensCoach";
const SESSION_STORAGE_KEY = "lenscoach_session";

export type AuthSession = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
};

type StoredAuthSession = AuthSession & { saved_at: number };

type AuthSessionListener = (session: AuthSession | null) => void;

let currentSession: AuthSession | null = null;
let refreshPromise: Promise<AuthSession> | null = null;
const authSessionListeners = new Set<AuthSessionListener>();

function persistAuthSession(session: AuthSession | null) {
  try {
    if (!session) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    const payload: StoredAuthSession = { ...session, saved_at: Date.now() };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable in private mode
  }
}

function loadStoredAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (!parsed.access_token || !parsed.user) return null;
    const maxAgeMs = Math.max(60, parsed.expires_in || 900) * 1000;
    const savedAt = parsed.saved_at || 0;
    if (!savedAt || Date.now() - savedAt > maxAgeMs) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return {
      access_token: parsed.access_token,
      token_type: parsed.token_type || "bearer",
      expires_in: parsed.expires_in || 900,
      user: parsed.user as User,
    };
  } catch {
    return null;
  }
}

export function hydrateAuthSessionFromStorage(): AuthSession | null {
  const stored = loadStoredAuthSession();
  if (!stored) return null;
  currentSession = stored;
  return stored;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getAccessToken() {
  return currentSession?.access_token ?? null;
}

export function setAuthSession(session: AuthSession | null) {
  currentSession = session;
  persistAuthSession(session);
  authSessionListeners.forEach((listener) => listener(session));
}

export function updateAuthUser(user: User) {
  if (!currentSession) return;
  setAuthSession({ ...currentSession, user });
}

export function subscribeToAuthSession(listener: AuthSessionListener) {
  authSessionListeners.add(listener);
  return () => {
    authSessionListeners.delete(listener);
  };
}

export function clearLegacyStoredAuth() {
  localStorage.removeItem("lenscoach_token");
  localStorage.removeItem("lenscoach_user");
}

function formatApiError(detail: unknown, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === "string") {
    if (detail === "Not Found") return "接口不存在，请确认后端已在 8001 端口启动";
    return detail;
  }
  if (Array.isArray(detail)) {
    const fieldLabels: Record<string, string> = {
      email: "邮箱",
      password: "密码",
      username: "用户名",
    };
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as { msg?: unknown; loc?: unknown[] };
          const field = Array.isArray(record.loc) ? String(record.loc[record.loc.length - 1] || "") : "";
          const label = fieldLabels[field] || field;
          const msg = String(record.msg || "");
          if (label && msg) {
            if (msg === "Field required") return `${label}不能为空`;
            if (msg.includes("at least")) return `${label}长度不符合要求`;
            return `${label}：${msg}`;
          }
          if (record.msg) return String(record.msg);
        }
        return JSON.stringify(item);
      })
      .join("；");
  }
  if (typeof detail === "object") {
    if ("msg" in detail) return String((detail as { msg: unknown }).msg);
    return JSON.stringify(detail);
  }
  return fallback;
}

async function responseError(response: Response): Promise<Error> {
  const responseText = await response.text().catch(() => "");
  let data: { detail?: unknown } | null = null;
  if (responseText) {
    try {
      data = JSON.parse(responseText) as { detail?: unknown };
    } catch {
      data = null;
    }
  }
  if (response.status === 500 && !data?.detail) {
    return new Error("服务器内部错误，请检查数据库是否已启动");
  }
  const fallback = response.status === 504
    ? "AI 处理超时（HTTP 504），请重试"
    : `请求失败（HTTP ${response.status}），请稍后重试`;
  return new Error(formatApiError(data?.detail, fallback));
}

function fetchApi(path: string, options: RequestInit, token: string | null) {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("无法连接后端服务，请确认后端已启动：uvicorn app.main:app --reload");
  });
}

export function refreshAuthSession(): Promise<AuthSession> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetchApi(
    "/auth/refresh",
    { method: "POST", headers: { "X-Session-Request": SESSION_REQUEST_HEADER } },
    null,
  )
    .then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) {
          const fallback = loadStoredAuthSession();
          if (fallback) {
            setAuthSession(fallback);
            return fallback;
          }
          setAuthSession(null);
          throw new Error("登录已过期，请重新登录");
        }
        throw await responseError(response);
      }
      const session = await response.json() as AuthSession;
      setAuthSession(session);
      return session;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export function getAssetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  // Static uploads are served directly (nginx /uploads/ with long cache), not via /api proxy.
  if (path.startsWith("/uploads/")) return path;
  return `${API_BASE_URL}${path}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
): Promise<T> {
  const token = getAccessToken();
  let response = await fetchApi(path, options, token);

  if (response.status === 401 && token && allowRefresh && !path.startsWith("/auth/")) {
    try {
      await refreshAuthSession();
    } catch {
      throw new Error("登录已过期，请重新登录");
    }
    response = await fetchApi(path, options, getAccessToken());
  }

  if (response.status === 401) {
    if (token) setAuthSession(null);
    throw new Error("登录已过期，请重新登录");
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function sessionRequestHeaders() {
  return { "X-Session-Request": SESSION_REQUEST_HEADER };
}
