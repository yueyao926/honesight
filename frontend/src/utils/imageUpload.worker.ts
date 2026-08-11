/// <reference lib="webworker" />

type CompressionProfile = {
  maxDimension: number;
  targetBytes: number;
  initialQuality: number;
};

type WorkerRequest = {
  file: File;
  profile: CompressionProfile;
  maxPixels: number;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { file, profile, maxPixels } = event.data;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const pixels = bitmap.width * bitmap.height;
    if (!bitmap.width || !bitmap.height || pixels > maxPixels) {
      throw new Error("图片像素过高，请缩小到 4000 万像素以内");
    }
    if (file.size <= profile.targetBytes && Math.max(bitmap.width, bitmap.height) <= profile.maxDimension) {
      self.postMessage({ ok: true, unchanged: true });
      return;
    }

    const initialScale = Math.min(1, profile.maxDimension / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let smallest: Blob | null = null;

    for (let resizeRound = 0; resizeRound < 3; resizeRound += 1) {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持后台图片处理");
      context.drawImage(bitmap, 0, 0, width, height);

      let low = 0.5;
      let high = profile.initialQuality;
      let best: Blob | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const quality = attempt === 0 ? high : (low + high) / 2;
        const blob = await canvas.convertToBlob({ type: "image/webp", quality });
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= profile.targetBytes) {
          best = blob;
          low = quality;
          if (profile.targetBytes - blob.size < profile.targetBytes * 0.08) break;
        } else {
          high = quality;
        }
      }
      if (best) {
        const buffer = await best.arrayBuffer();
        self.postMessage({ ok: true, buffer }, { transfer: [buffer] });
        return;
      }
      const scale = Math.max(0.55, Math.min(0.88, Math.sqrt(profile.targetBytes / (smallest?.size || profile.targetBytes)) * 0.94));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    throw new Error("图片处理后仍然过大，请换一张图片重试");
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "图片处理失败，请重试" });
  } finally {
    bitmap?.close();
  }
};

export {};
