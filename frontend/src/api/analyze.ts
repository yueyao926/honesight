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

export type AnalysisJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: "preparing" | "analyzing" | "organizing" | "completed" | "failed" | string;
  progress: number;
  cache_hit: boolean;
  result: PhotoAnalysis | null;
  error: string | null;
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

export function getAnalysisJob(jobId: string, signal?: AbortSignal) {
  return apiRequest<AnalysisJob>(`/analyze/jobs/${jobId}`, { signal });
}

export async function waitForAnalysisJob(
  initial: AnalysisJob,
  signal: AbortSignal,
  onProgress: (job: AnalysisJob) => void,
): Promise<PhotoAnalysis> {
  let job = initial;
  while (true) {
    onProgress(job);
    if (job.status === "completed" && job.result) return job.result;
    if (job.status === "failed") throw new Error(job.error || "分析失败，请稍后重试");
    await abortableDelay(650, signal);
    job = await getAnalysisJob(job.id, signal);
  }
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
