import { FormEvent } from "react";
import type { BenchmarkDimension, ChatMessage, PhotoAnalysis } from "../../types";

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
  const advice = [...new Set(Object.values(suggestions).map((value) => String(value).trim()).filter(Boolean))]
    .map((value) => value.replace(/[。；;]+$/, ""))
    .join("；");
  return advice ? `${platform}发布建议：${advice}。` : "";
}

export function BenchmarkOverview({ analysis, targetPlatform }: { analysis: PhotoAnalysis; targetPlatform: string }) {
  const publishingAdvice = buildPublishingAdvice(analysis, targetPlatform);
  return (
    <div className="card">
      <p className="section-eyebrow">质量评估</p>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Metric label="综合评分" value={analysis.overall_score} />
        <Metric label="风格匹配度" value={analysis.target_style_match_score} />
        <Metric label="照片类型" value={analysis.photo_type} small />
        <Metric label="识别风格" value={analysis.detected_style} small />
      </div>
      <p className="mt-5 text-sm leading-7 text-muted">{analysis.summary}</p>
      {publishingAdvice && (
        <p className="mt-3 text-sm leading-7 text-muted">{publishingAdvice}</p>
      )}
    </div>
  );
}

function Metric({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-blush/40 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={small ? "mt-2 text-lg font-semibold text-ink" : "mt-2 font-display text-3xl font-semibold text-ink"}>
        {value}
      </p>
    </div>
  );
}

export function DimensionCards({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <section>
      <div className="mb-4">
        <p className="section-eyebrow">AI 四维评分</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">曝光、对焦、构图、色彩</h2>
        <p className="mt-2 text-xs text-muted">各维度由 AI 根据原图评估，综合分按照片类型加权计算。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {dimensions.map(([key, label]) => {
          const detail = analysis.benchmark_detail[key] as BenchmarkDimension | undefined;
          const score = analysis[`${key}_score` as keyof PhotoAnalysis] as number;
          const weight = analysis[`${key}_weight` as keyof PhotoAnalysis] as number;
          return (
            <div key={key} className="card">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold">{label}</h3>
                <span className="text-xs text-muted">权重 {(weight * 100).toFixed(0)}%</span>
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-sand">
                <div className="h-1.5 rounded-full bg-brand" style={{ width: `${score}%` }} />
              </div>
              <p className="mt-3 font-display text-2xl font-semibold">{score}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{detail?.reason}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">问题</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {detail?.problems?.map((item: string) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">建议</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {detail?.suggestions?.map((item: string) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StylePanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card">
      <p className="section-eyebrow">风格判断</p>
      <div className="mt-4">
        <Metric label="当前风格" value={analysis.detected_style} small />
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{analysis.style_reasoning}</p>
    </div>
  );
}

export function AdvicePanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card grid gap-4 md:grid-cols-2">
      <Advice title="构图建议" text={analysis.composition_advice} />
      <Advice title="光线建议" text={analysis.lighting_advice} />
      <Advice title="色彩建议" text={analysis.color_advice} />
      <Advice title="下一步" text={analysis.next_step} />
      <div className="md:col-span-2"><Advice title="下次拍摄建议" text={analysis.shooting_tips} /></div>
    </div>
  );
}

function Advice({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-muted">{text}</p>
    </div>
  );
}

export function ParamsPanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card">
      <p className="section-eyebrow">修图参数</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">Lightroom & 手机 App</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <ParamTable title="Lightroom" params={analysis.editing_params.lightroom || {}} />
        <ParamTable title="手机修图 App" params={analysis.editing_params.mobile_apps || {}} />
      </div>
    </div>
  );
}

function ParamTable({ title, params }: { title: string; params: Record<string, string> }) {
  return (
    <div className="rounded-2xl bg-blush/30 p-4">
      <h3 className="font-medium text-ink">{title}</h3>
      <div className="mt-3 grid gap-2">
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="flex justify-between rounded-xl bg-white/70 px-3 py-2 text-sm">
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
            className="rounded-full border border-sand bg-white/60 px-3 py-2 text-xs text-muted transition hover:border-brand hover:text-brand-deep"
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
