import { FormEvent } from "react";
import type { BenchmarkDimension, ChatMessage, PhotoAnalysis } from "../../types";
import arrow8Svg from "../../SVG/arrow-8.svg?url";
import notebookSvg from "../../SVG/笔记本.svg?url";
import StudioBikeLoader from "../studio/StudioBikeLoader";
import StudioJumpCubeLoader from "../studio/StudioJumpCubeLoader";
import StudioProgressBar from "../studio/StudioProgressBar";
import StudioTapHandLoader from "../studio/StudioTapHandLoader";

const dimensions = [
  ["exposure", "曝光"],
  ["focus", "对焦"],
  ["composition", "构图"],
  ["color", "色彩"],
] as const;

const quickQuestions = [
  "怎么调成日系清新风？",
  "这张适合发小红书吗？",
  "Lightroom 参数能更具体一点吗？",
  "如果是人像照，构图还可以怎么改？",
  "帮我生成一段小红书文案。",
];

function asDisplayText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asDisplayText(item)).filter(Boolean);
}

function buildPublishingAdvice(analysis: PhotoAnalysis, targetPlatform: string) {
  const entries = Object.entries(analysis.platform_suggestions || {});
  const aliases: Record<string, string[]> = {
    微信朋友圈: ["微信朋友圈", "朋友圈"],
  };
  const acceptedNames = aliases[targetPlatform] || [targetPlatform];
  const selected = entries.find(([platform]) => acceptedNames.includes(platform))
    || (entries.length === 1 ? entries[0] : undefined);
  if (!selected) return "";
  const [platform, suggestions] = selected;
  if (!suggestions || typeof suggestions !== "object" || Array.isArray(suggestions)) {
    return asDisplayText(suggestions) ? `${platform}发布建议：${asDisplayText(suggestions)}。` : "";
  }
  const advice = [...new Set(Object.values(suggestions).map((value) => asDisplayText(value)).filter(Boolean))]
    .map((value) => value.replace(/[。；;]+$/, ""))
    .join("；");
  return advice ? `${platform}发布建议：${advice}。` : "";
}

function DetailsToggleArrow({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-blush/55 ${large ? "h-9 w-9" : "h-8 w-8"}`}
      aria-hidden="true"
    >
      <img
        src={arrow8Svg}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`analysis-panel-arrow rotate-180 transition-transform group-open:rotate-0 ${large ? "analysis-panel-arrow--lg" : ""}`}
      />
    </span>
  );
}

export function BenchmarkOverview({ analysis, targetPlatform }: { analysis: PhotoAnalysis; targetPlatform: string }) {
  const publishingAdvice = buildPublishingAdvice(analysis, targetPlatform);
  return (
    <section className="studio-result-section">
      <div className="studio-section-heading">
        <StudioBikeLoader />
        <p className="section-eyebrow">质量评估</p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <Metric label="综合评分" value={analysis.overall_score} />
        <Metric label="风格匹配度" value={analysis.target_style_match_score} />
        <Metric label="照片类型" value={asDisplayText(analysis.photo_type)} small />
        <Metric label="识别风格" value={asDisplayText(analysis.detected_style)} small />
      </div>
      <p className="mt-5 text-sm leading-7 text-muted">{asDisplayText(analysis.summary)}</p>
      {publishingAdvice && (
        <p className="mt-3 text-sm leading-7 text-muted">{publishingAdvice}</p>
      )}
    </section>
  );
}

function Metric({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={small ? "mt-2 text-lg font-semibold text-ink" : "mt-2 font-display text-3xl font-semibold text-ink"}>
        {value}
      </p>
    </div>
  );
}

export function DimensionCards({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <section className="studio-result-section">
      <div className="mb-4">
        <div className="studio-section-heading">
          <StudioTapHandLoader />
          <p className="section-eyebrow">AI 四维评分</p>
        </div>
        <h2 className="mt-1 font-display text-2xl font-semibold">曝光、对焦、构图、色彩</h2>
        <p className="mt-2 text-xs text-muted">各维度由 AI 根据原图评估，综合分按照片类型加权计算。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {dimensions.map(([key, label]) => {
          const detail = analysis.benchmark_detail[key] as BenchmarkDimension | undefined;
          const score = analysis[`${key}_score` as keyof PhotoAnalysis] as number;
          const weight = analysis[`${key}_weight` as keyof PhotoAnalysis] as number;
          return (
            <details key={key} className="studio-dimension-card group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block font-display text-xl font-semibold">{label}</span>
                    <span className="mt-1 block text-xs text-muted">权重 {(weight * 100).toFixed(0)}%</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-display text-3xl font-semibold text-ink">{score}</span>
                    <DetailsToggleArrow />
                  </span>
                </span>
                <StudioProgressBar value={score} className="mt-4" />
              </summary>
              <div className="studio-dimension-detail mt-5">
                <p className="text-sm leading-7 text-muted">{asDisplayText(detail?.reason)}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">问题</p>
                {asStringList(detail?.problems).length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                    {asStringList(detail?.problems).map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">暂未发现明显问题。</p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export function AdvicePanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <section className="studio-result-section">
      <details className="group studio-advice-panel" open>
        <summary className="studio-advice-summary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-4">
            <span>
              <span className="studio-section-heading">
                <StudioJumpCubeLoader />
                <span className="section-eyebrow block">AI 教练建议</span>
              </span>
              <span className="mt-1 block font-display text-2xl font-semibold sm:text-3xl">
                针对这张照片的整体改进建议
              </span>
            </span>
            <DetailsToggleArrow large />
          </span>
          <p className="studio-advice-hint group-open:hidden">快打开查看教练建议吧</p>
        </summary>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Advice title="构图建议" text={analysis.composition_advice} />
          <Advice title="光线建议" text={analysis.lighting_advice} />
          <Advice title="色彩建议" text={analysis.color_advice} />
          <Advice title="下一步" text={analysis.next_step} />
          <div className="md:col-span-2"><Advice title="下次拍摄建议" text={analysis.shooting_tips} /></div>
        </div>
      </details>
    </section>
  );
}

function Advice({ title, text }: { title: string; text: unknown }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted">{asDisplayText(text)}</p>
    </div>
  );
}

function normalizeParamRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")
      .map(([key, entry]) => [
        key,
        typeof entry === "string" ? entry : typeof entry === "number" ? String(entry) : JSON.stringify(entry),
      ]),
  );
}

function coerceEditingParams(value: PhotoAnalysis["editing_params"] | unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function collectEditingParamSections(editingParams: PhotoAnalysis["editing_params"] | unknown) {
  const source = coerceEditingParams(editingParams);
  const lightroom = normalizeParamRecord(source.lightroom);
  const mobileApps = normalizeParamRecord(source.mobile_apps);
  const general = normalizeParamRecord(
    Object.fromEntries(
      Object.entries(source).filter(([key]) => key !== "lightroom" && key !== "mobile_apps"),
    ),
  );
  return { lightroom, mobileApps, general };
}

export function ParamsPanel({ analysis }: { analysis: PhotoAnalysis }) {
  const { lightroom, mobileApps, general } = collectEditingParamSections(analysis.editing_params);
  const hasAnyParams = Object.keys(lightroom).length > 0 || Object.keys(mobileApps).length > 0 || Object.keys(general).length > 0;

  return (
    <section className="studio-result-section">
      <div className="studio-section-heading">
        <img src={notebookSvg} alt="" aria-hidden="true" className="studio-section-mark" draggable={false} />
        <p className="section-eyebrow">修图参数</p>
      </div>
      <h2 className="mt-1 font-display text-2xl font-semibold">Lightroom & 手机 App</h2>
      {!hasAnyParams ? (
        <p className="mt-4 text-sm leading-7 text-muted">参数还在整理中，或本次结果没有返回可展示的修图数值。</p>
      ) : (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {Object.keys(lightroom).length > 0 && <ParamTable title="Lightroom" params={lightroom} />}
          {Object.keys(mobileApps).length > 0 && <ParamTable title="手机修图 App" params={mobileApps} />}
          {Object.keys(general).length > 0 && (
            <div className="md:col-span-2">
              <ParamTable title="通用参数" params={general} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type EditingDetailsPanelProps = {
  analysis: PhotoAnalysis;
  targetPlatform: string;
  detailsLoading: boolean;
  detailsError: string;
  onLoadDetails: () => void;
};

export function EditingDetailsPanel({
  analysis,
  targetPlatform,
  detailsLoading,
  detailsError,
  onLoadDetails,
}: EditingDetailsPanelProps) {
  const publishingAdvice = buildPublishingAdvice(analysis, targetPlatform);
  const { lightroom, mobileApps, general } = collectEditingParamSections(analysis.editing_params);
  const hasAnyParams = Object.keys(lightroom).length > 0 || Object.keys(mobileApps).length > 0 || Object.keys(general).length > 0;
  const hasDetails = hasAnyParams || Boolean(publishingAdvice);

  return (
    <section className="studio-result-section studio-details-panel">
      <div className="studio-section-heading">
        <img src={notebookSvg} alt="" aria-hidden="true" className="studio-section-mark" draggable={false} />
        <p className="section-eyebrow text-ink">修图参数与发布建议</p>
      </div>
      <h2 className="mt-1 font-display text-2xl font-semibold text-ink">后期调整 & 平台发布</h2>

      {detailsLoading && (
        <p className="mt-4 text-sm leading-7 text-ink">正在后台生成修图参数与发布建议，请稍候…</p>
      )}

      {!detailsLoading && !hasDetails && (
        <>
          <p className="mt-4 text-sm leading-7 text-ink">
            四维核心结果已完成；这部分在后台生成，不会阻塞你查看曝光、对焦、构图与色彩建议。
          </p>
          <button className="btn-secondary ink-focus-frame mt-5 text-ink hover:border-ink" type="button" onClick={onLoadDetails}>
            生成详细参数
          </button>
        </>
      )}

      {!detailsLoading && hasAnyParams && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {Object.keys(lightroom).length > 0 && <ParamTable title="Lightroom" params={lightroom} />}
          {Object.keys(mobileApps).length > 0 && <ParamTable title="手机修图 App" params={mobileApps} />}
          {Object.keys(general).length > 0 && (
            <div className="md:col-span-2">
              <ParamTable title="通用参数" params={general} />
            </div>
          )}
        </div>
      )}

      {!detailsLoading && publishingAdvice && (
        <div className="studio-insight-panel mt-5">
          <p className="text-xs font-medium text-ink">发布建议</p>
          <p className="mt-2 text-sm leading-7 text-muted">{publishingAdvice}</p>
        </div>
      )}

      {detailsError && <p className="mt-3 text-sm text-red-500">{detailsError}</p>}
    </section>
  );
}

function ParamTable({ title, params }: { title: string; params: Record<string, string> }) {
  const entries = Object.entries(params);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl bg-blush/30 p-4">
      <h3 className="font-medium text-ink">{title}</h3>
      <div className="mt-3 grid gap-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between rounded-xl bg-blush/35 px-3 py-2 text-sm">
            <span className="text-muted">{key}</span>
            <span className="font-medium text-ink">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({
  messages,
  input,
  setInput,
  loading,
  onSubmit,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  onSubmit: (event?: FormEvent<HTMLFormElement>, preset?: string) => void;
}) {
  return (
    <div className="card">
      <p className="section-eyebrow">继续追问</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">AI 摄影教练</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {quickQuestions.map((question) => (
          <button
            key={question}
            type="button"
            className="rounded-full border border-sand bg-white/60 px-3 py-2 text-xs text-muted transition hover:border-brand hover:text-ink"
            onClick={() => onSubmit(undefined, question)}
            disabled={loading}
          >
            {question}
          </button>
        ))}
      </div>
      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-cream/80 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">还没有对话，可以从快捷问题开始。</p>
        ) : (
          messages.map((message) => (
            <div key={`${message.id}-${message.created_at}`} className={message.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  message.role === "user"
                    ? "inline-block rounded-2xl bg-brand px-4 py-3 text-sm text-white"
                    : "inline-block rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-ink shadow-card"
                }
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>
      <form className="mt-4 flex gap-3" onSubmit={onSubmit}>
        <input
          className="input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="例如：这张照片怎么调成日系清新风？"
        />
        <button className="btn-primary shrink-0" disabled={loading} type="submit">
          {loading ? "发送中" : "发送"}
        </button>
      </form>
    </div>
  );
}
