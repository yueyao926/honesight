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
  metadata: { width: number; height: number; orientation: number } | null;
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { file, profile, maxPixels, metadata } = event.data;
  let bitmap: ImageBitmap | null = null;
  try {
    const sourceWidth = metadata?.width || 0;
    const sourceHeight = metadata?.height || 0;
    const sourcePixels = sourceWidth * sourceHeight;
    if (sourcePixels > maxPixels) {
      throw new Error(`图片像素过高，请缩小到 ${Math.round(maxPixels / 10_000_000) / 10} 亿像素以内`);
    }
    if (sourceWidth && sourceHeight && file.size <= profile.targetBytes && Math.max(sourceWidth, sourceHeight) <= profile.maxDimension) {
      self.postMessage({ ok: true, unchanged: true });
      return;
    }

    const orientationSwapsAxes = Boolean(metadata && metadata.orientation >= 5 && metadata.orientation <= 8);
    const orientedWidth = orientationSwapsAxes ? sourceHeight : sourceWidth;
    const orientedHeight = orientationSwapsAxes ? sourceWidth : sourceHeight;
    const resizeScale = orientedWidth && orientedHeight
      ? Math.min(1, profile.maxDimension / Math.max(orientedWidth, orientedHeight))
      : 1;
    const resizeWidth = Math.max(1, Math.round(orientedWidth * resizeScale));
    const resizeHeight = Math.max(1, Math.round(orientedHeight * resizeScale));
    bitmap = orientedWidth && orientedHeight
      ? await createImageBitmap(file, {
          imageOrientation: "from-image",
          resizeWidth,
          resizeHeight,
          resizeQuality: "high",
        })
      : await createImageBitmap(file, { imageOrientation: "from-image" });

    const decodedPixels = bitmap.width * bitmap.height;
    if (!bitmap.width || !bitmap.height || (!sourcePixels && decodedPixels > maxPixels)) {
      throw new Error(`图片像素过高，请缩小到 ${Math.round(maxPixels / 10_000_000) / 10} 亿像素以内`);
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
