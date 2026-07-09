import { apiRequest } from "./client";
import type { User } from "../types";

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

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

export function getMe() {
  return apiRequest<User>("/auth/me");
}
