export const MAX_IMAGE_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_PIXELS = 40_000_000;
export const MAX_AVATAR_UPLOAD_BYTES = 1024 * 1024;

export type ImageUploadPurpose = "standard" | "reference";
export type ImageUploadStage = "optimizing" | "uploading";

type CompressionProfile = {
  maxDimension: number;
  targetBytes: number;
  initialQuality: number;
};

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PROFILES: Record<ImageUploadPurpose, CompressionProfile> = {
  standard: { maxDimension: 3200, targetBytes: 2.5 * 1024 * 1024, initialQuality: 0.88 },
  reference: { maxDimension: 1920, targetBytes: 1024 * 1024, initialQuality: 0.84 },
};

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
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片");
  }
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error("单张图片不能超过 10MB");
  }

  const image = await loadImage(file);
  const pixels = image.naturalWidth * image.naturalHeight;
  if (!image.naturalWidth || !image.naturalHeight || pixels > MAX_IMAGE_SOURCE_PIXELS) {
    throw new Error("图片像素过高，请缩小到 4000 万像素以内");
  }

  const profile = PROFILES[purpose];
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

  for (let resizeRound = 0; resizeRound < 9; resizeRound += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器不支持图片处理");
    context.drawImage(image, 0, 0, width, height);

    for (let quality = profile.initialQuality; quality >= 0.52; quality -= 0.06) {
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= profile.targetBytes) {
        const filename = `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`;
        return new File([blob], filename, { type: "image/webp", lastModified: Date.now() });
      }
    }

    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
  }

  throw new Error(smallest ? "图片处理后仍然过大，请换一张图片重试" : "图片处理失败，请重试");
}
