import { getAssetUrl } from "../api/client";
import { getQuickPreviewFilter } from "../utils/quickPreview";

type Props = {
  imageUrl: string;
  targetStyle: string;
  targetPlatform?: string;
  description?: string;
  referenceUrls?: string[];
  generatedImageUrls?: string[];
  selectedGeneratedImageUrl?: string | null;
  onSelectGeneratedImage?: (url: string | null) => void;
  onSaveOriginal?: () => void;
  onSaveQuickPreview?: () => void;
  onSaveAiResult?: (url: string) => void;
  savingQuickPreview?: boolean;
  compact?: boolean;
};

export default function ExpectedEffectPreview({
  imageUrl,
  targetStyle,
  targetPlatform = "",
  description = "",
  referenceUrls = [],
  generatedImageUrls = [],
  selectedGeneratedImageUrl = null,
  onSelectGeneratedImage,
  onSaveOriginal,
  onSaveQuickPreview,
  onSaveAiResult,
  savingQuickPreview = false,
  compact = false,
}: Props) {
  const isAiResult = Boolean(selectedGeneratedImageUrl);
  const aspectClass = targetPlatform === "抖音"
    ? "aspect-[9/16]"
    : ["小红书", "Instagram"].includes(targetPlatform) ? "aspect-[4/5]" : compact ? "aspect-[4/3]" : "aspect-[4/5]";

  return (
    <div className={compact ? "mt-7 rounded-3xl bg-blush/35 p-5 md:p-6" : "card-soft"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">{compact ? "快速预览" : "效果对比"}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
            {compact ? `${targetStyle}${targetPlatform ? ` · ${targetPlatform}` : ""}` : "原图与处理效果"}
          </h2>
        </div>
        {isAiResult && <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-muted">AI 精修图</span>}
      </div>

      {(onSaveOriginal || (!isAiResult && onSaveQuickPreview) || (isAiResult && onSaveAiResult)) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onSaveOriginal && (
            <button className="btn-secondary px-4 py-2 text-xs" type="button" onClick={onSaveOriginal}>保存原图</button>
          )}
          {!isAiResult && onSaveQuickPreview && (
            <button className="btn-secondary px-4 py-2 text-xs" type="button" onClick={onSaveQuickPreview} disabled={savingQuickPreview}>
              {savingQuickPreview ? "正在生成预览…" : "保存快速预览"}
            </button>
          )}
          {isAiResult && selectedGeneratedImageUrl && onSaveAiResult && (
            <button className="btn-secondary px-4 py-2 text-xs" type="button" onClick={() => onSaveAiResult(selectedGeneratedImageUrl)}>
              保存这张 AI 精修图
            </button>
          )}
        </div>
      )}

      {!compact && generatedImageUrls.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2" aria-label="效果图版本">
          <button
            type="button"
            className={`preview-version ${!selectedGeneratedImageUrl ? "preview-version-active" : ""}`}
            onClick={() => onSelectGeneratedImage?.(null)}
          >
            快速预览
          </button>
          {generatedImageUrls.map((url, index) => (
            <button
              key={url}
              type="button"
              className={`preview-version ${selectedGeneratedImageUrl === url ? "preview-version-active" : ""}`}
              onClick={() => onSelectGeneratedImage?.(url)}
            >
              AI 精修 {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">原图</p>
          <div className="photo-frame bg-white/60">
            <img className={`${aspectClass} w-full object-cover`} src={getAssetUrl(imageUrl)} alt="原图" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-brand-deep">
            {isAiResult ? "AI 精修" : "快速预览"}
          </p>
          <div className="photo-frame relative overflow-hidden bg-white/60">
            <img
              className={`${aspectClass} w-full object-cover transition duration-500`}
              src={getAssetUrl(selectedGeneratedImageUrl || imageUrl)}
              alt={isAiResult ? "AI 精修效果" : `${targetStyle}快速预览`}
              style={isAiResult ? undefined : { filter: getQuickPreviewFilter(targetStyle) }}
            />
            {!isAiResult && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rose/15 via-transparent to-white/5" />}
          </div>
        </div>
      </div>

      {!compact && referenceUrls.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted">风格参考</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {referenceUrls.map((url) => (
              <img key={url} className="h-16 w-16 shrink-0 rounded-xl object-cover ring-2 ring-white" src={getAssetUrl(url)} alt="风格参考" />
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-6 text-muted">
        {description || "快速预览只模拟整体色调与发布比例；局部光影、肤色与细节将在 AI 精修后呈现。"}
      </p>
    </div>
  );
}
