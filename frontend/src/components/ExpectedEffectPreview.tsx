import { getAssetUrl } from "../api/client";

const STYLE_FILTERS: Array<[string, string]> = [
  ["黑白", "grayscale(1) contrast(1.12) brightness(1.01)"],
  ["赛博朋克", "brightness(.94) contrast(1.2) saturate(1.35) hue-rotate(12deg)"],
  ["暗调", "brightness(.82) contrast(1.16) saturate(.82)"],
  ["明亮通透", "brightness(1.12) contrast(.94) saturate(.96)"],
  ["清新自然", "brightness(1.08) contrast(.92) saturate(.9) hue-rotate(-3deg)"],
  ["日系", "brightness(1.09) contrast(.88) saturate(.8) sepia(.06) hue-rotate(-5deg)"],
  ["韩系", "brightness(1.1) contrast(.9) saturate(.86) sepia(.04)"],
  ["胶片", "brightness(1.01) contrast(1.06) saturate(.76) sepia(.16) hue-rotate(7deg)"],
  ["电影", "brightness(.96) contrast(1.14) saturate(.82) sepia(.08)"],
  ["复古", "brightness(.97) contrast(1.08) saturate(.7) sepia(.24)"],
  ["港风", "brightness(.94) contrast(1.17) saturate(1.08) sepia(.1)"],
  ["法式", "brightness(1.06) contrast(.92) saturate(.82) sepia(.1)"],
  ["森系", "brightness(1.01) contrast(.93) saturate(.83) hue-rotate(10deg)"],
  ["莫兰迪", "brightness(1.04) contrast(.9) saturate(.62) sepia(.05)"],
  ["高级灰", "brightness(1.01) contrast(.96) saturate(.52) grayscale(.12)"],
  ["低饱和", "brightness(1.02) contrast(.96) saturate(.58)"],
  ["高饱和", "brightness(1.03) contrast(1.1) saturate(1.28)"],
  ["纪实", "brightness(1.01) contrast(1.09) saturate(.82)"],
  ["人像", "brightness(1.07) contrast(.94) saturate(.9) sepia(.04)"],
  ["生活记录", "brightness(1.05) contrast(.93) saturate(.9)"],
  ["商业", "brightness(1.04) contrast(1.12) saturate(.96)"],
  ["极简", "brightness(1.1) contrast(.95) saturate(.72)"],
];

function resolveFilter(targetStyle: string): string {
  return STYLE_FILTERS.find(([key]) => targetStyle.includes(key))?.[1]
    || "brightness(1.05) contrast(.94) saturate(.9)";
}

type Props = {
  imageUrl: string;
  targetStyle: string;
  targetPlatform?: string;
  description?: string;
  referenceUrls?: string[];
  generatedImageUrls?: string[];
  selectedGeneratedImageUrl?: string | null;
  onSelectGeneratedImage?: (url: string | null) => void;
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
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-muted">
          {isAiResult ? "AI 精修图" : "即时模拟 · 不耗额度"}
        </span>
      </div>

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
              style={isAiResult ? undefined : { filter: resolveFilter(targetStyle) }}
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
