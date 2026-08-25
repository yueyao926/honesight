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

export function verifyEmail(token: string) {
  return apiRequest<{ detail: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(email: string) {
  return apiRequest<{ detail: string }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest<{ detail: string }>("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiRequest<{ detail: string }>("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
