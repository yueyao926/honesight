import { apiRequest } from "./client";
import type { PhotoAnalysis } from "../types";

export type AnalyzePayload = {
  portfolio_item_id: number;
  target_style?: string;
  target_platform?: string;
  style_reference_image_urls?: string[];
};

export type PreviewAnalyzePayload = {
  image_url: string;
  style_reference_image_urls: string[];
  target_style?: string;
  target_platform?: string;
  title?: string;
  description?: string;
  category?: string;
};

export type QuickAnalysis = {
  photo_type: string;
  detected_style: string;
  exposure_score: number;
  focus_score: number;
  composition_score: number;
  color_score: number;
  priority_issue: string;
  primary_ability: "构图" | "光线" | "清晰度" | "色彩" | string;
  summary: string;
  suggestion: string;
  confidence: number;
  model_used: string;
  elapsed_ms: number;
};

export type AnalysisDetails = {
  editing_params: PhotoAnalysis["editing_params"];
  platform_suggestions: PhotoAnalysis["platform_suggestions"];
  model_used: string;
  elapsed_ms: number;
};

export type AnalysisJob<T = PhotoAnalysis> = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: "preparing" | "analyzing" | "organizing" | "completed" | "failed" | string;
  progress: number;
  cache_hit: boolean;
  result: T | null;
  error: string | null;
  elapsed_ms: number;
};

export function previewAnalyze(payload: PreviewAnalyzePayload, signal?: AbortSignal) {
  return apiRequest<PhotoAnalysis>("/analyze/preview", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function startPreviewAnalysis(payload: PreviewAnalyzePayload, signal?: AbortSignal) {
  return apiRequest<AnalysisJob>("/analyze/preview/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function startQuickAnalysis(payload: PreviewAnalyzePayload, signal?: AbortSignal) {
  return apiRequest<AnalysisJob<QuickAnalysis>>("/analyze/preview/quick-jobs", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function startAnalysisDetails(
  payload: Pick<PreviewAnalyzePayload, "image_url" | "target_style" | "target_platform"> & { analysis_summary: string },
  signal?: AbortSignal,
) {
  return apiRequest<AnalysisJob<AnalysisDetails>>("/analyze/details/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function getAnalysisJob<T>(jobId: string, signal?: AbortSignal) {
  return apiRequest<AnalysisJob<T>>(`/analyze/jobs/${jobId}`, { signal });
}

export async function waitForAnalysisJob<T>(
  initial: AnalysisJob<T>,
  signal: AbortSignal,
  onProgress: (job: AnalysisJob<T>) => void,
  options: { maxWaitMs?: number } = {},
): Promise<T> {
  const startedAt = performance.now();
  const maxWaitMs = options.maxWaitMs ?? 60_000;
  let job = initial;
  while (true) {
    onProgress(job);
    if (job.status === "completed" && job.result) return job.result;
    if (job.status === "failed") throw new Error(job.error || "分析失败，请稍后重试");
    const elapsedMs = performance.now() - startedAt;
    if (elapsedMs >= maxWaitMs) throw new Error("分析等待超时，请重试；后台任务不会重复创建");
    const pollMs = elapsedMs < 2_000 ? 400 : elapsedMs < 10_000 ? 750 : 1_500;
    await abortableDelay(Math.min(pollMs, maxWaitMs - elapsedMs), signal);
    job = await getAnalysisJob<T>(job.id, signal);
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function analyzePhoto(payload: AnalyzePayload) {
  return apiRequest<PhotoAnalysis>("/analyze/photo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPhotoAnalysis(portfolioItemId: string | number) {
  return apiRequest<PhotoAnalysis>(`/portfolio/${portfolioItemId}/analysis`);
}

export const getLatestAnalysis = getPhotoAnalysis;
