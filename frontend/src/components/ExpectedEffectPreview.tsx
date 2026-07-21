import { getAssetUrl } from "../api/client";

const STYLE_FILTERS: Record<string, string> = {
  日系: "brightness(1.06) contrast(0.88) saturate(0.82) sepia(0.06) hue-rotate(-5deg)",
  清新自然: "brightness(1.08) contrast(0.9) saturate(0.88) hue-rotate(-3deg)",
  胶片感: "brightness(1.02) contrast(1.05) saturate(0.75) sepia(0.18) hue-rotate(8deg)",
  复古: "brightness(0.98) contrast(1.08) saturate(0.7) sepia(0.22)",
  高级灰: "brightness(1.02) contrast(0.95) saturate(0.55) grayscale(0.15)",
  高饱和: "brightness(1.04) contrast(1.1) saturate(1.25)",
  生活记录: "brightness(1.05) contrast(0.92) saturate(0.9)",
  商业感: "brightness(1.03) contrast(1.12) saturate(0.95)",
};

function resolveFilter(targetStyle: string): string {
  for (const [key, filter] of Object.entries(STYLE_FILTERS)) {
    if (targetStyle.includes(key)) return filter;
  }
  return "brightness(1.05) contrast(0.92) saturate(0.9)";
}

type Props = {
  imageUrl: string;
  generatedImageUrl?: string | null;
  targetStyle: string;
  description: string;
  referenceUrls?: string[];
};

export default function ExpectedEffectPreview({ imageUrl, generatedImageUrl, targetStyle, description, referenceUrls = [] }: Props) {
  const filter = resolveFilter(targetStyle);

  return (
    <div className="card-soft">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-eyebrow">预期效果</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">修图后视觉预览</h2>
        </div>
        {generatedImageUrl ? (
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-muted">AI generated image</span>
        ) : (
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-muted">模拟预览 · 非最终成片</span>
        )}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">当前作品</p>
          <div className="photo-frame">
            <img className="aspect-[4/5] w-full object-cover" src={getAssetUrl(imageUrl)} alt="当前作品" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-brand-deep">预期效果</p>
          <div className="photo-frame relative overflow-hidden">
            <img
              className="aspect-[4/5] w-full object-cover"
              src={getAssetUrl(generatedImageUrl || imageUrl)}
              alt="预期效果"
              style={generatedImageUrl ? undefined : { filter }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rose/20 via-transparent to-blush/10" />
          </div>
        </div>
      </div>

      {referenceUrls.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted">风格参考</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {referenceUrls.map((url) => (
              <img
                key={url}
                className="h-16 w-16 shrink-0 rounded-xl object-cover ring-2 ring-white"
                src={getAssetUrl(url)}
                alt="风格参考"
              />
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-sm leading-7 text-muted">{description}</p>
    </div>
  );
}
