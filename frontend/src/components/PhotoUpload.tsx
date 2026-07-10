import { useRef, useState } from "react";
import { getAssetUrl } from "../api/client";
import { uploadImage } from "../api/upload";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

export default function PhotoUpload({ value, onChange, label = "上传照片" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | null) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const uploaded = await uploadImage(file);
      onChange(uploaded.image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {value ? (
        <div className="group relative inline-block">
          <img
            className="max-h-80 w-full rounded-3xl object-cover shadow-card ring-4 ring-white"
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
          className="flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-sand bg-white/50 transition hover:border-brand hover:bg-blush/30"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <span className="font-display text-4xl font-light text-brand">+</span>
          <span className="mt-2 text-sm text-muted">{uploading ? "上传中..." : label}</span>
          <span className="mt-1 text-xs text-muted">支持 JPG / PNG / WebP</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0] || null)}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
