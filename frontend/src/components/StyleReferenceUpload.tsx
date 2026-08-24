import { useRef, useState } from "react";
import { getAssetUrl } from "../api/client";
import { uploadImage } from "../api/upload";
import type { ImageUploadStage } from "../utils/imageUpload";

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
};

export default function StyleReferenceUpload({ value, onChange, maxFiles = 3 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<ImageUploadStage | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      const remaining = maxFiles - value.length;
      const selected = Array.from(files).slice(0, remaining);
      if (selected.length === 0) {
        throw new Error(`最多上传 ${maxFiles} 张风格参考图`);
      }

      setProgress({ current: 1, total: selected.length });
      const imageUrls: string[] = [];
      for (let index = 0; index < selected.length; index += 1) {
        setProgress({ current: index + 1, total: selected.length });
        const uploaded = await uploadImage(selected[index], "reference", setStage);
        imageUrls.push(uploaded.image_url);
        onChange([...value, ...imageUrls]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setStage(null);
      setProgress({ current: 0, total: 0 });
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const statusText = stage === "optimizing"
    ? "正在准备"
    : stage === "processing"
      ? "正在确认"
      : "正在上传";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <div key={url} className="group relative">
            <img
              className="h-28 w-28 rounded-2xl object-cover"
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
            className="flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sand bg-transparent text-xs text-ink transition hover:border-ink focus-visible:border-ink focus-visible:outline-none"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(stage)}
          >
            <span className="text-2xl font-light text-ink">+</span>
            <span className="mt-1">
              {stage ? `${statusText} ${progress.current}/${progress.total}` : "添加参考图"}
            </span>
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
      <p className="text-xs text-ink/70">最多 {maxFiles} 张，单张最大 10MB</p>
      {error && <p className="text-xs text-ink">{error}</p>}
    </div>
  );
}
