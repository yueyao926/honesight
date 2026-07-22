import { useRef, useState } from "react";
import { getAssetUrl } from "../api/client";
import { uploadImage } from "../api/upload";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
};

export default function StyleReferenceUpload({ value, onChange, maxFiles = 4 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setUploading(true);
    try {
      const remaining = maxFiles - value.length;
      const selected = Array.from(files).slice(0, remaining);
      if (selected.length === 0) {
        throw new Error(`最多上传 ${maxFiles} 张风格参考图`);
      }
      const uploaded = await Promise.all(selected.map((file) => uploadImage(file)));
      onChange([...value, ...uploaded.map((item) => item.image_url)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <div key={url} className="group relative">
            <img
              className="h-28 w-28 rounded-2xl object-cover shadow-card ring-2 ring-white"
              src={getAssetUrl(url)}
              alt={`风格参考 ${index + 1}`}
            />
            <button
              type="button"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-white opacity-0 transition group-hover:opacity-100"
              onClick={() => removeAt(index)}
            >
              ×
            </button>
          </div>
        ))}
        {value.length < maxFiles && (
          <button
            type="button"
            className="flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sand bg-white/50 text-xs text-muted transition hover:border-brand hover:text-brand-deep"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <span className="text-2xl font-light text-brand">+</span>
            <span className="mt-1">{uploading ? "上传中" : "添加参考"}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
      <p className="text-xs text-muted">最多 {maxFiles} 张</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
