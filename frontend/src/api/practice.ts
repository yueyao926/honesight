import { apiRequest } from "./client";
import type { PracticeSession } from "../types";


export function getCurrentPractice() {
  return apiRequest<PracticeSession>("/practice/current");
}

export function submitPracticeAttempt(payload: { image_url: string; self_reflection: string }) {
  return apiRequest<PracticeSession>("/practice/current/attempts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
