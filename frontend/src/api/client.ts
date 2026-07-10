const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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

export function getAssetUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path}`;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("lenscoach_token");
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  }).catch(() => {
    throw new Error("无法连接后端服务，请确认后端已启动：uvicorn app.main:app --reload");
  });

  if (response.status === 401) {
    localStorage.removeItem("lenscoach_token");
    localStorage.removeItem("lenscoach_user");
    window.location.href = "/login";
    throw new Error("登录已过期，请重新登录");
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    if (response.status === 500 && !data?.detail) {
      throw new Error("服务器内部错误，请检查数据库是否已启动");
    }
    throw new Error(formatApiError(data?.detail, "请求失败，请稍后重试"));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
