import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  encodeCanvasWithinLimit,
  MAX_AVATAR_UPLOAD_BYTES,
  MAX_IMAGE_SOURCE_BYTES,
  MAX_IMAGE_SOURCE_PIXELS,
} from "../utils/imageUpload";

type Props = {
  onSave: (blob: Blob) => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
};

export default function AvatarUploader({ onSave, onReset, onClose }: Props) {
  const [src, setSrc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("请选择 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > MAX_IMAGE_SOURCE_BYTES) {
      setError("原图不能超过 10MB");
      return;
    }
    setError("");
    setSrc(URL.createObjectURL(file));
    setZoom(1);
  }

  function validatePixels(image: HTMLImageElement) {
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_SOURCE_PIXELS) {
      setError("图片像素过高，请缩小到 4000 万像素以内");
      setSrc("");
    }
  }

  async function crop() {
    const image = imageRef.current;
    if (!image) return;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器不支持图片裁剪");
      const base = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
      context.drawImage(
        image,
        (image.naturalWidth - base) / 2,
        (image.naturalHeight - base) / 2,
        base,
        base,
        0,
        0,
        512,
        512,
      );
      const blob = await encodeCanvasWithinLimit(canvas, MAX_AVATAR_UPLOAD_BYTES, "image/jpeg", 0.88);
      await onSave(blob);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function resetAvatar() {
    setBusy(true);
    setError("");
    try {
      await onReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复默认头像失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-lg bg-cream">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">更换头像</h2>
          <button className="btn-ghost" onClick={onClose}>关闭</button>
        </div>
        <input
          className="mt-6 block w-full text-sm"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
        />
        <p className="mt-2 text-xs text-muted">原图最大 10MB，裁剪后自动压缩至 1MB 内</p>
        {src && (
          <>
            <div className="mx-auto mt-6 h-64 w-64 overflow-hidden rounded-full bg-sand">
              <img
                ref={imageRef}
                src={src}
                alt="头像裁剪预览"
                className="h-full w-full object-cover"
                style={{ transform: `scale(${zoom})` }}
                onLoad={(event) => validatePixels(event.currentTarget)}
              />
            </div>
            <label className="mt-5 block text-sm">
              缩放
              <input
                className="ml-3 w-48"
                type="range"
                min="1"
                max="2.5"
                step=".05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-primary" disabled={!src || busy} onClick={crop}>
            {busy ? "正在上传…" : "裁剪并保存"}
          </button>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={resetAvatar}
          >
            恢复默认头像
          </button>
        </div>
      </div>
    </div>
  );
}
