import { apiRequest, sessionRequestHeaders, type AuthSession } from "./client";
import type { User } from "../types";

export type LoginResponse = AuthSession;

export function register(payload: { username: string; email: string; password: string }) {
  return apiRequest<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return apiRequest<void>("/auth/logout", {
    method: "POST",
    headers: sessionRequestHeaders(),
  }, false);
}

export function getMe() {
  return apiRequest<User>("/auth/me");
}
