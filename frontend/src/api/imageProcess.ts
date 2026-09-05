import { apiRequest } from "./client";

export type ImageProcessPayload = {
  image_url: string;
  target_style: string;
  target_platform: string;
  analysis_guidance?: string;
  edit_instruction?: string;
  reference_image_urls?: string[];
};

export type ImageProcessResult = {
  image_url: string;
  thumbnail_url?: string;
  model: string;
  prompt: string;
  editing_strategy?: string;
};

export type ImageProcessJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: string;
  progress: number;
  result: ImageProcessResult | null;
  error: string | null;
  elapsed_ms: number;
};

export function startProcessedImageJob(payload: ImageProcessPayload, signal?: AbortSignal) {
  return apiRequest<ImageProcessJob>("/image-process/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export async function getProcessedImageJob(jobId: string, signal?: AbortSignal) {
  const requestController = new AbortController();
  const forwardAbort = () => requestController.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = window.setTimeout(() => requestController.abort(), 15_000);
  try {
    return await apiRequest<ImageProcessJob>(`/image-process/jobs/${encodeURIComponent(jobId)}`, {
      signal: requestController.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (requestController.signal.aborted) throw new Error("精修状态查询超时");
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

export async function waitForProcessedImageJob(
  initial: ImageProcessJob,
  signal: AbortSignal,
  onProgress: (job: ImageProcessJob) => void,
  options: { maxWaitMs?: number; maxConsecutivePollErrors?: number } = {},
): Promise<ImageProcessResult> {
  const startedAt = performance.now();
  const maxWaitMs = options.maxWaitMs ?? 8 * 60_000;
  const maxConsecutivePollErrors = options.maxConsecutivePollErrors ?? 4;
  let consecutivePollErrors = 0;
  let job = initial;

  while (true) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    onProgress(job);
    if (job.status === "completed") {
      if (job.result) return job.result;
      throw new Error("AI 精修任务已完成，但服务器没有返回图片结果");
    }
    if (job.status === "failed") throw new Error(job.error || "AI 精修失败，请稍后重试");

    const elapsedMs = performance.now() - startedAt;
    if (elapsedMs >= maxWaitMs) {
      throw new Error("AI 精修等待超时，任务可能仍在后台处理，请稍后重试");
    }

    const normalPollMs = elapsedMs < 10_000 ? 1_000 : elapsedMs < 60_000 ? 2_000 : 3_000;
    await abortableDelay(Math.min(normalPollMs, maxWaitMs - elapsedMs), signal);

    try {
      job = await getProcessedImageJob(job.id, signal);
      consecutivePollErrors = 0;
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (!isRetryablePollError(error) || consecutivePollErrors >= maxConsecutivePollErrors) {
        throw error;
      }
      consecutivePollErrors += 1;
      const retryMs = Math.min(8_000, 1_000 * (2 ** (consecutivePollErrors - 1)));
      await abortableDelay(retryMs, signal);
    }
  }
}

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRetryablePollError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return (
    error.message.includes("无法连接后端服务")
    || /HTTP (?:408|429|500|502|503|504)/.test(error.message)
    || error.message.includes("AI 处理超时")
    || error.message.includes("精修状态查询超时")
  );
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
