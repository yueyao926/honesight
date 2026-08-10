import { apiRequest } from "./client";
import type { PracticeOverview, PracticeSession } from "../types";

export type StartPracticePayload = {
  entry_mode: "improve" | "category";
  source_image_url?: string;
  target_goal?: "构图" | "光线" | "清晰度" | "色彩" | "不确定";
  category?: "人像" | "风景" | "拍物";
  plan_role?: "primary" | "optional";
  replace_current?: boolean;
  replace_session_id?: number;
};

export type PracticeAttemptJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: string;
  progress: number;
  result: PracticeSession | null;
  error: string | null;
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

export function startPracticeSessionJob(payload: StartPracticePayload, signal?: AbortSignal) {
  return apiRequest<PracticeAttemptJob>("/practice/session-jobs", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function getPracticeSessionJob(jobId: string, signal?: AbortSignal) {
  return apiRequest<PracticeAttemptJob>(`/practice/session-jobs/${jobId}`, { signal });
}

export async function waitForPracticeSessionJob(
  initial: PracticeAttemptJob,
  signal: AbortSignal,
  onProgress: (job: PracticeAttemptJob) => void,
): Promise<PracticeSession> {
  let job = initial;
  while (true) {
    onProgress(job);
    if (job.status === "completed" && job.result) return job.result;
    if (job.status === "failed") throw new Error(job.error || "任务生成失败，请稍后重试");
    await abortableDelay(650, signal);
    job = await getPracticeSessionJob(job.id, signal);
  }
}

export function markPracticeStarted(sessionId: number) {
  return apiRequest<PracticeSession>(`/practice/sessions/${sessionId}/start`, {
    method: "PATCH",
  });
}

export function submitPracticeAttempt(sessionId: number, payload: { image_urls: string[]; self_reflection?: string }) {
  return apiRequest<PracticeSession>(`/practice/sessions/${sessionId}/attempts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startPracticeAttemptJob(sessionId: number, payload: { image_urls: string[]; self_reflection?: string }, signal?: AbortSignal) {
  return apiRequest<PracticeAttemptJob>(`/practice/sessions/${sessionId}/attempt-jobs`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function getPracticeAttemptJob(jobId: string, signal?: AbortSignal) {
  return apiRequest<PracticeAttemptJob>(`/practice/attempt-jobs/${jobId}`, { signal });
}

export async function waitForPracticeAttemptJob(
  initial: PracticeAttemptJob,
  signal: AbortSignal,
  onProgress: (job: PracticeAttemptJob) => void,
): Promise<PracticeSession> {
  let job = initial;
  while (true) {
    onProgress(job);
    if (job.status === "completed" && job.result) return job.result;
    if (job.status === "failed") throw new Error(job.error || "练习反馈生成失败，请稍后重试");
    await abortableDelay(650, signal);
    job = await getPracticeAttemptJob(job.id, signal);
  }
}

export function completePracticeSession(sessionId: number) {
  return apiRequest<PracticeSession>(`/practice/sessions/${sessionId}/complete`, {
    method: "POST",
  });
}

export function updatePracticeDifficulty(sessionId: number, difficulty: "too_easy" | "just_right" | "too_hard") {
  return apiRequest<PracticeSession>(`/practice/sessions/${sessionId}/difficulty`, {
    method: "PATCH",
    body: JSON.stringify({ difficulty }),
  });
}


function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}
