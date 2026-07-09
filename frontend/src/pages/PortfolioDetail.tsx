import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { analyzePhoto, getPhotoAnalysis } from "../api/analyze";
import { getPhotoChat, sendPhotoChatMessage } from "../api/chat";
import { getAssetUrl } from "../api/client";
import { deletePortfolioItem, getPortfolioItem } from "../api/portfolio";
import type { BenchmarkDimension, ChatMessage, PhotoAnalysis, PortfolioItem } from "../types";

const targetStyles = ["清新自然", "日系", "胶片感", "高级灰", "复古", "高饱和", "生活记录", "商业感"];
const targetPlatforms = ["小红书", "朋友圈", "Instagram", "作品集", "商业约拍"];
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

export default function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [targetStyle, setTargetStyle] = useState("清新自然");
  const [targetPlatform, setTargetPlatform] = useState("小红书");
  const [chatInput, setChatInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPortfolioItem(id)
      .then((data) => {
        setItem(data);
        setTargetStyle(data.target_style || "清新自然");
        setTargetPlatform(data.target_platform || "小红书");
      })
      .catch((err) => setError(err.message));
    getPhotoAnalysis(id).then(setAnalysis).catch(() => setAnalysis(null));
    getPhotoChat(id).then(setMessages).catch(() => setMessages([]));
  }, [id]);

  const benchmark = useMemo(() => analysis?.benchmark_detail || {}, [analysis]);

  async function handleAnalyze() {
    if (!item) return;
    setLoading(true);
    setError("");
    try {
      const data = await analyzePhoto({
        portfolio_item_id: item.id,
        target_style: targetStyle,
        target_platform: targetPlatform,
      });
      setAnalysis(data);
      setItem({ ...item, target_style: targetStyle, target_platform: targetPlatform });
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm("确定删除这个作品吗？")) return;
    await deletePortfolioItem(id);
    navigate("/portfolio");
  }

  async function handleChat(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    if (!id) return;
    const message = (preset || chatInput).trim();
    if (!message) return;
    setChatLoading(true);
    setChatInput("");
    const optimistic: ChatMessage = {
      id: Date.now(),
      portfolio_item_id: Number(id),
      user_id: 0,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    try {
      const reply = await sendPhotoChatMessage(id, message);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          portfolio_item_id: Number(id),
          user_id: 0,
          role: "assistant",
          content: reply.reply,
          created_at: reply.created_at,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setChatLoading(false);
    }
  }

  if (!item) {
    return <main className="container-page"><div className="card">{error || "加载中..."}</div></main>;
  }

  return (
    <main className="container-page">
      <Link className="text-sm text-brand" to="/portfolio">返回作品集</Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="card p-0">
            <img className="max-h-[620px] w-full rounded-2xl object-cover" src={getAssetUrl(item.image_url)} alt={item.title} />
          </div>
          <div className="card">
            <h1 className="text-3xl font-semibold">AI 摄影教练</h1>
            <p className="mt-3 text-muted">基于目标风格的摄影成长建议，不是 AI 判断照片好坏。</p>
            <div className="mt-5 space-y-2 text-sm text-muted">
              <p>作品：<span className="text-ink">{item.title}</span></p>
              <p>描述：{item.description || "暂无描述"}</p>
              <p>分类：{item.category || "general"} · 创建时间：{new Date(item.created_at).toLocaleString()}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">本次目标风格</label>
                <select className="input" value={targetStyle} onChange={(event) => setTargetStyle(event.target.value)}>
                  {targetStyles.map((style) => <option key={style}>{style}</option>)}
                </select>
              </div>
              <div>
                <label className="label">本次发布平台</label>
                <select className="input" value={targetPlatform} onChange={(event) => setTargetPlatform(event.target.value)}>
                  {targetPlatforms.map((platform) => <option key={platform}>{platform}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>{loading ? "分析中..." : "开始 AI 分析"}</button>
              <button className="btn-secondary" onClick={handleDelete}>删除作品</button>
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div className="space-y-5">
          {!analysis ? (
            <div className="card">
              <h2 className="text-2xl font-semibold">还没有摄影建议报告</h2>
              <p className="mt-3 text-muted">选择目标风格和发布平台后，点击“开始 AI 分析”。没有 API Key 时也会使用 mock 模式完整展示。</p>
            </div>
          ) : (
            <>
              <BenchmarkOverview analysis={analysis} />
              <DimensionCards analysis={analysis} />
              <StylePanel analysis={analysis} />
              <AdvicePanel analysis={analysis} />
              <ParamsPanel analysis={analysis} />
              <PlatformPanel analysis={analysis} />
              <ChatPanel
                messages={messages}
                input={chatInput}
                setInput={setChatInput}
                loading={chatLoading}
                onSubmit={handleChat}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function BenchmarkOverview({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card">
      <p className="text-sm font-semibold text-brand">基础画面质量 benchmark</p>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <Metric label="综合 benchmark" value={analysis.overall_score} />
        <Metric label="目标风格匹配度" value={analysis.target_style_match_score} />
        <Metric label="照片类型" value={analysis.photo_type} small />
        <Metric label="系统判断风格" value={analysis.detected_style} small />
      </div>
      <p className="mt-5 text-sm leading-7 text-muted">{analysis.summary}</p>
      <p className="mt-3 text-sm text-muted">{String(analysis.benchmark_detail.weight_reason || "")}</p>
      <div className="mt-3 text-xs text-muted">模式：{analysis.analysis_mode} · 模型：{analysis.model_used}</div>
    </div>
  );
}

function Metric({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-soft p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={small ? "mt-2 text-lg font-semibold text-ink" : "mt-2 text-3xl font-semibold text-ink"}>{value}</p>
    </div>
  );
}

function DimensionCards({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {dimensions.map(([key, label]) => {
        const detail = analysis.benchmark_detail[key] as BenchmarkDimension | undefined;
        const score = analysis[`${key}_score` as keyof PhotoAnalysis] as number;
        const weight = analysis[`${key}_weight` as keyof PhotoAnalysis] as number;
        return (
          <div key={key} className="card">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{label}</h3>
              <span className="text-sm text-muted">权重 {(weight * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${score}%` }} />
            </div>
            <p className="mt-3 text-2xl font-semibold">{score}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{detail?.reason}</p>
            <p className="mt-3 text-sm font-semibold">问题</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{detail?.problems?.map((item) => <li key={item}>{item}</li>)}</ul>
            <p className="mt-3 text-sm font-semibold">建议</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{detail?.suggestions?.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        );
      })}
    </div>
  );
}

function StylePanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card">
      <h2 className="text-2xl font-semibold">风格判断</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Metric label="detected_style" value={analysis.detected_style} small />
        <Metric label="style_confidence" value={`${Math.round(analysis.style_confidence * 100)}%`} small />
        <Metric label="目标风格匹配度" value={analysis.target_style_match_score} />
      </div>
      <p className="mt-4 text-sm leading-7 text-muted">{analysis.style_reasoning}</p>
    </div>
  );
}

function AdvicePanel({ analysis }: { analysis: PhotoAnalysis }) {
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
  return <div><h3 className="font-semibold text-ink">{title}</h3><p className="mt-2 text-sm leading-7 text-muted">{text}</p></div>;
}

function ParamsPanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card">
      <h2 className="text-2xl font-semibold">修图参数建议</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <ParamTable title="Lightroom" params={analysis.editing_params.lightroom || {}} />
        <ParamTable title="手机修图 App" params={analysis.editing_params.mobile_apps || {}} />
      </div>
    </div>
  );
}

function ParamTable({ title, params }: { title: string; params: Record<string, string> }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 grid gap-2">
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="flex justify-between rounded-xl bg-soft px-3 py-2 text-sm">
            <span className="text-muted">{key}</span><span className="font-medium text-ink">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformPanel({ analysis }: { analysis: PhotoAnalysis }) {
  return (
    <div className="card">
      <h2 className="text-2xl font-semibold">平台发布建议</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {Object.entries(analysis.platform_suggestions).map(([platform, suggestion]) => (
          <div key={platform} className="rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold">{platform}</h3>
            <div className="mt-3 space-y-2 text-sm text-muted">
              {Object.entries(suggestion).map(([key, value]) => <p key={key}><span className="text-ink">{key}：</span>{value}</p>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({
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
      <h2 className="text-2xl font-semibold">继续问 AI 摄影教练</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {quickQuestions.map((question) => (
          <button key={question} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-muted hover:border-brand hover:text-brand" onClick={() => onSubmit(undefined, question)} disabled={loading}>
            {question}
          </button>
        ))}
      </div>
      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
        {messages.length === 0 ? <p className="text-sm text-muted">还没有对话，可以从快捷问题开始。</p> : messages.map((message) => (
          <div key={`${message.id}-${message.created_at}`} className={message.role === "user" ? "text-right" : "text-left"}>
            <div className={message.role === "user" ? "inline-block rounded-2xl bg-brand px-4 py-3 text-sm text-white" : "inline-block rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-ink"}>
              {message.content}
            </div>
          </div>
        ))}
      </div>
      <form className="mt-4 flex gap-3" onSubmit={onSubmit}>
        <input className="input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="例如：这张照片怎么调成日系清新风？" />
        <button className="btn-primary shrink-0" disabled={loading} type="submit">{loading ? "发送中" : "发送"}</button>
      </form>
    </div>
  );
}
