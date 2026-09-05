import { readImageMetadata, type ImageMetadata } from "./imageDimensions";

export const MAX_IMAGE_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_PIXELS = 40_000_000;
export const MAX_AI_IMAGE_SOURCE_BYTES = 100 * 1024 * 1024;
export const MAX_AI_IMAGE_SOURCE_PIXELS = 120_000_000;
export const MAX_AVATAR_UPLOAD_BYTES = 1024 * 1024;

export type ImageUploadPurpose = "standard" | "reference" | "analysis" | "practice" | "portfolio" | "community";
export type ImageUploadStage = "optimizing" | "uploading" | "processing";

type CompressionProfile = {
  maxDimension: number;
  targetBytes: number;
  initialQuality: number;
};

type SourceLimits = {
  maxBytes: number;
  maxPixels: number;
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function normalizeImageFile(file: File): File {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return file;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXTENSION_MIME[extension];
  if (!mime) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片");
  }
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}
const PROFILES: Record<ImageUploadPurpose, CompressionProfile> = {
  standard: { maxDimension: 2560, targetBytes: 1.5 * 1024 * 1024, initialQuality: 0.85 },
  reference: { maxDimension: 1920, targetBytes: 800 * 1024, initialQuality: 0.82 },
  analysis: { maxDimension: 2048, targetBytes: 800 * 1024, initialQuality: 0.8 },
  practice: { maxDimension: 2048, targetBytes: 800 * 1024, initialQuality: 0.8 },
  portfolio: { maxDimension: 2560, targetBytes: 1.5 * 1024 * 1024, initialQuality: 0.85 },
  community: { maxDimension: 2560, targetBytes: 1.5 * 1024 * 1024, initialQuality: 0.85 },
};

const STANDARD_SOURCE_LIMITS: SourceLimits = {
  maxBytes: MAX_IMAGE_SOURCE_BYTES,
  maxPixels: MAX_IMAGE_SOURCE_PIXELS,
};

const AI_SOURCE_LIMITS: SourceLimits = {
  maxBytes: MAX_AI_IMAGE_SOURCE_BYTES,
  maxPixels: MAX_AI_IMAGE_SOURCE_PIXELS,
};

export function imageSourceLimits(purpose: ImageUploadPurpose): SourceLimits {
  return purpose === "analysis" || purpose === "practice"
    ? AI_SOURCE_LIMITS
    : STANDARD_SOURCE_LIMITS;
}

function megapixels(pixels: number): string {
  return `${Math.round(pixels / 10_000_000) / 10} 亿`;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片读取失败，请换一张图片重试"));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("浏览器无法处理这张图片"))),
      type,
      quality,
    );
  });
}

export async function encodeCanvasWithinLimit(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  type = "image/jpeg",
  initialQuality = 0.88,
): Promise<Blob> {
  let smallest: Blob | null = null;
  for (let quality = initialQuality; quality >= 0.5; quality -= 0.07) {
    const blob = await canvasToBlob(canvas, type, quality);
    if (!smallest || blob.size < smallest.size) smallest = blob;
    if (blob.size <= maxBytes) return blob;
  }
  if (!smallest || smallest.size > maxBytes) {
    throw new Error("图片处理后仍然过大，请换一张图片重试");
  }
  return smallest;
}

export async function optimizeImageForUpload(
  file: File,
  purpose: ImageUploadPurpose,
): Promise<File> {
  file = normalizeImageFile(file);
  const limits = imageSourceLimits(purpose);
  if (file.size > limits.maxBytes) {
    throw new Error(`单张原图不能超过 ${Math.round(limits.maxBytes / 1024 / 1024)}MB`);
  }

  const profile = PROFILES[purpose];
  const metadata = await readImageMetadata(file);
  if (metadata && metadata.width * metadata.height > limits.maxPixels) {
    throw new Error(`图片像素过高，请缩小到 ${megapixels(limits.maxPixels)}像素以内`);
  }
  const highResolution = Boolean(
    metadata && metadata.width * metadata.height > MAX_IMAGE_SOURCE_PIXELS,
  );
  if (
    typeof Worker !== "undefined"
    && typeof OffscreenCanvas !== "undefined"
    && typeof createImageBitmap !== "undefined"
  ) {
    try {
      return await optimizeInWorker(file, profile, limits.maxPixels, metadata);
    } catch (error) {
      if (error instanceof Error && error.message.includes("像素过高")) throw error;
      if (highResolution) {
        throw new Error("超高像素原图后台压缩失败，请关闭其他占用内存的页面后重试，或改用桌面版 Chrome / Edge");
      }
      // Older Safari/WebView builds may expose OffscreenCanvas without WebP encoding.
      // Fall back to the DOM canvas path in that case.
    }
  }

  if (highResolution) {
    throw new Error("当前浏览器无法安全处理超高像素原图，请使用桌面版 Chrome / Edge 上传");
  }

  const image = await loadImage(file);
  const pixels = image.naturalWidth * image.naturalHeight;
  if (!image.naturalWidth || !image.naturalHeight || pixels > limits.maxPixels) {
    throw new Error(`图片像素过高，请缩小到 ${megapixels(limits.maxPixels)}像素以内`);
  }

  if (
    file.size <= profile.targetBytes
    && Math.max(image.naturalWidth, image.naturalHeight) <= profile.maxDimension
  ) {
    return file;
  }

  const initialScale = Math.min(1, profile.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
  let smallest: Blob | null = null;

  for (let resizeRound = 0; resizeRound < 3; resizeRound += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持图片处理");
    context.drawImage(image, 0, 0, width, height);

    let low = 0.5;
    let high = profile.initialQuality;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const quality = attempt === 0 ? high : (low + high) / 2;
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= profile.targetBytes) {
        low = quality;
        if (attempt === 4 || profile.targetBytes - blob.size < profile.targetBytes * 0.08) {
          return webpFile(blob, file.name);
        }
      } else {
        high = quality;
      }
    }

    if (smallest && smallest.size <= profile.targetBytes) {
      return webpFile(smallest, file.name);
    }

    const scale = Math.max(0.55, Math.min(0.88, Math.sqrt(profile.targetBytes / (smallest?.size || profile.targetBytes)) * 0.94));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  throw new Error(smallest ? "图片处理后仍然过大，请换一张图片重试" : "图片处理失败，请重试");
}


function optimizeInWorker(
  file: File,
  profile: CompressionProfile,
  maxPixels: number,
  metadata: ImageMetadata | null,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./imageUpload.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{
      ok: boolean;
      unchanged?: boolean;
      buffer?: ArrayBuffer;
      error?: string;
    }>) => {
      worker.terminate();
      if (!event.data.ok) {
        reject(new Error(event.data.error || "图片处理失败，请重试"));
        return;
      }
      if (event.data.unchanged) {
        resolve(file);
        return;
      }
      if (!event.data.buffer) {
        reject(new Error("图片处理失败，请重试"));
        return;
      }
      resolve(webpFile(new Blob([event.data.buffer], { type: "image/webp" }), file.name));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("浏览器后台图片处理不可用"));
    };
    worker.postMessage({ file, profile, maxPixels, metadata });
  });
}


function webpFile(blob: Blob, originalName: string): File {
  const filename = `${originalName.replace(/\.[^.]+$/, "") || "image"}.webp`;
  return new File([blob], filename, { type: "image/webp", lastModified: Date.now() });
}
