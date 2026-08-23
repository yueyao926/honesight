import { useRef, useState } from "react";
import { getAssetUrl } from "../api/client";
import { uploadImage } from "../api/upload";
import type { ImageUploadPurpose, ImageUploadStage } from "../utils/imageUpload";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  purpose?: ImageUploadPurpose;
  outlineOnly?: boolean;
  compactPreview?: boolean;
  previewMaxHeight?: number;
};

export default function PhotoUpload({
  value,
  onChange,
  label = "上传照片",
  purpose = "standard",
  outlineOnly = false,
  compactPreview = false,
  previewMaxHeight,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<ImageUploadStage | null>(null);
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file) return;
    setError("");
    setStage("optimizing");
    try {
      const uploaded = await uploadImage(file, purpose, setStage);
      onChange(uploaded.image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setStage(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const statusText = stage === "optimizing"
    ? "正在准备图片…"
    : stage === "processing"
      ? "服务器正在确认图片…"
      : "正在上传…";

  const panelPreviewStyle = compactPreview && previewMaxHeight
    ? { maxHeight: `${previewMaxHeight}px` }
    : undefined;

  return (
    <div className="space-y-4">
      {value ? (
        <div className="group relative inline-block max-w-full">
          <img
            className={
              compactPreview
                ? "w-auto max-w-md rounded-3xl object-contain"
                : "max-h-80 w-full rounded-3xl object-cover shadow-card ring-4 ring-white"
            }
            style={panelPreviewStyle}
            src={getAssetUrl(value)}
            alt="待分析照片"
          />
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
            onClick={() => onChange(null)}
          >
            更换照片
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={
            outlineOnly
              ? "group flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sand bg-transparent transition hover:border-ink"
              : "group flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sand bg-white/50 shadow-card transition hover:border-ink hover:bg-blush/30"
          }
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(stage)}
        >
          <span className="font-display text-4xl font-light text-ink transition group-hover:text-ink">+</span>
          <span className="mt-2 text-sm text-muted transition group-hover:text-ink">{stage ? statusText : label}</span>
          <span className="mt-1 text-xs text-muted transition group-hover:text-ink">JPG / PNG / WebP，单张最大 10MB</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0] || null)}
      />
      {error && <p className="text-xs text-ink">{error}</p>}
    </div>
  );
}
