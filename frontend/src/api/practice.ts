import { apiRequest } from "./client";
import type { PracticeOverview, PracticeSession } from "../types";

export type StartPracticePayload = {
  entry_mode: "improve" | "category";
  source_image_url?: string;
  target_goal?: "构图" | "光线" | "清晰度" | "色彩" | "不确定";
  category?: "人像" | "风景" | "拍物";
  replace_current?: boolean;
};

export function getPracticeOverview() {
  return apiRequest<PracticeOverview>("/practice/overview");
}

export function getCurrentPractice() {
  return apiRequest<PracticeSession>("/practice/current");
}

export function startPracticeSession(payload: StartPracticePayload) {
  return apiRequest<PracticeSession>("/practice/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitPracticeAttempt(payload: { image_urls: string[]; self_reflection?: string }) {
  return apiRequest<PracticeSession>("/practice/current/attempts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completePracticeSession() {
  return apiRequest<PracticeSession>("/practice/current/complete", {
    method: "POST",
  });
}

export function updatePracticeDifficulty(difficulty: "too_easy" | "just_right" | "too_hard") {
  return apiRequest<PracticeSession>("/practice/current/difficulty", {
    method: "PATCH",
    body: JSON.stringify({ difficulty }),
  });
}
