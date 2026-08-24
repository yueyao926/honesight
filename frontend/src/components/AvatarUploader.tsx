import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
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

type Offset = { x: number; y: number };

function clampOffset(offset: Offset, zoom: number, image: HTMLImageElement, frameSize: number): Offset {
  const minSide = Math.min(image.naturalWidth, image.naturalHeight);
  const base = minSide / zoom;
  const maxX = Math.max(0, (image.naturalWidth / base - 1) * (frameSize / 2));
  const maxY = Math.max(0, (image.naturalHeight / base - 1) * (frameSize / 2));
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  };
}

export default function AvatarUploader({ onSave, onReset, onClose }: Props) {
  const [src, setSrc] = useState("");
  const [fileName, setFileName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);

  function frameSize() {
    return frameRef.current?.clientWidth || 256;
  }

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
    setFileName(file.name);
    setSrc(URL.createObjectURL(file));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function validatePixels(image: HTMLImageElement) {
    if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_SOURCE_PIXELS) {
      setError("图片像素过高，请缩小到 4000 万像素以内");
      setSrc("");
      setFileName("");
    }
  }

  function applyZoom(nextZoom: number) {
    const image = imageRef.current;
    setZoom(nextZoom);
    if (!image) return;
    setOffset((current) => clampOffset(current, nextZoom, image, frameSize()));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const image = imageRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !image) return;
    setOffset(
      clampOffset(
        {
          x: drag.ox + event.clientX - drag.x,
          y: drag.oy + event.clientY - drag.y,
        },
        zoom,
        image,
        frameSize(),
      ),
    );
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
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
      const minSide = Math.min(image.naturalWidth, image.naturalHeight);
      const base = minSide / zoom;
      const size = frameSize();
      const sx = (image.naturalWidth - base) / 2 - (offset.x * base) / size;
      const sy = (image.naturalHeight - base) / 2 - (offset.y * base) / size;
      context.drawImage(
        image,
        Math.max(0, Math.min(image.naturalWidth - base, sx)),
        Math.max(0, Math.min(image.naturalHeight - base, sy)),
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
      <div className="card avatar-uploader w-full max-w-lg bg-cream">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">更换头像</h2>
          <button className="avatar-uploader-close" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="avatar-uploader-file-row">
          <label className="avatar-uploader-file">
            选择文件
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choose}
            />
          </label>
          <span className="avatar-uploader-file-name">{fileName || "未选择文件"}</span>
        </div>
        <p className="mt-2 text-xs text-muted">原图最大 10MB</p>
        {src && (
          <>
            <div
              ref={frameRef}
              className="avatar-uploader-stage mx-auto mt-6 h-64 w-64 overflow-hidden rounded-full bg-sand"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                ref={imageRef}
                src={src}
                alt="头像裁剪预览"
                draggable={false}
                className="h-full w-full object-cover"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                onLoad={(event) => validatePixels(event.currentTarget)}
              />
            </div>
            <p className="avatar-uploader-hint">拖拽图片调整位置</p>
            <label className="avatar-uploader-zoom mt-4 block text-sm">
              缩放
              <input
                type="range"
                min="1"
                max="2.5"
                step=".05"
                value={zoom}
                onChange={(event) => applyZoom(Number(event.target.value))}
              />
            </label>
          </>
        )}
        {error && <p className="mt-4 text-sm text-ink">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="avatar-uploader-save" type="button" disabled={!src || busy} onClick={crop}>
            {busy ? "正在上传…" : "裁剪并保存"}
          </button>
          <button className="avatar-uploader-reset" type="button" disabled={busy} onClick={resetAvatar}>
            恢复默认头像
          </button>
        </div>
      </div>
    </div>
  );
}
