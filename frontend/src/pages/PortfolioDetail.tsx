import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { analyzePhoto, getPhotoAnalysis } from "../api/analyze";
import { getPhotoChat, sendPhotoChatMessage } from "../api/chat";
import { getAssetUrl } from "../api/client";
import { deletePortfolioItem, getPortfolioItem } from "../api/portfolio";
import {
  AdvicePanel,
  BenchmarkOverview,
  ChatPanel,
  DimensionCards,
  ParamsPanel,
  PlatformPanel,
  StylePanel,
} from "../components/analysis/AnalysisPanels";
import type { ChatMessage, PhotoAnalysis, PortfolioItem } from "../types";

export default function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPortfolioItem(id)
      .then(setItem)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "加载失败"));

    getPhotoAnalysis(id)
      .then(setAnalysis)
      .catch(() => setAnalysis(null))
      .finally(() => setAnalysisLoading(false));

    getPhotoChat(id)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [id]);

  async function handleDelete() {
    if (!id || !window.confirm("确定删除这个作品吗？")) return;
    await deletePortfolioItem(id);
    navigate("/portfolio");
  }

  async function handleReanalyze() {
    if (!id || !item) return;
    setReanalyzing(true);
    setError("");
    try {
      const data = await analyzePhoto({
        portfolio_item_id: item.id,
        target_style: item.target_style || undefined,
        target_platform: item.target_platform || undefined,
      });
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重新分析失败");
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleChatSubmit(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    if (!id) return;
    const text = (preset ?? chatInput).trim();
    if (!text || chatLoading) return;

    const optimistic: ChatMessage = {
      id: Date.now(),
      portfolio_item_id: Number(id),
      user_id: item?.user_id ?? 0,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setChatInput("");
    setChatLoading(true);
    setError("");
    try {
      const reply = await sendPhotoChatMessage(id, text);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          portfolio_item_id: Number(id),
          user_id: item?.user_id ?? 0,
          role: "assistant",
          content: reply.reply,
          created_at: reply.created_at,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后再试");
    } finally {
      setChatLoading(false);
    }
  }

  if (!item) {
    return (
      <main className="container-page">
        <div className="card mt-10 text-center">
          {loadError ? (
            <>
              <h2 className="font-display text-2xl font-semibold">无法加载作品</h2>
              <p className="mt-3 text-sm text-muted">{loadError}</p>
              <Link className="btn-secondary mt-6 inline-block" to="/portfolio">返回作品集</Link>
            </>
          ) : (
            <p className="text-sm text-muted">加载中…</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="container-page">
      <Link className="text-sm text-brand-deep" to="/portfolio">← 返回作品集</Link>

      <section className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="photo-frame animate-fade-up">
          <img className="w-full object-cover" src={getAssetUrl(item.image_url)} alt={item.title} />
        </div>

        <div className="space-y-5">
          <div className="card animate-fade-up">
            <p className="section-eyebrow">Portfolio</p>
            <h1 className="mt-1 font-display text-4xl font-semibold">{item.title}</h1>
            <p className="mt-4 text-sm leading-7 text-muted">{item.description || "暂无描述"}</p>

            <dl className="mt-6 grid gap-3 text-sm">
              <div className="flex justify-between border-b border-sand/60 py-2">
                <dt className="text-muted">分类</dt>
                <dd className="text-ink">{item.category || "未分类"}</dd>
              </div>
              <div className="flex justify-between border-b border-sand/60 py-2">
                <dt className="text-muted">目标风格</dt>
                <dd className="text-ink">{item.target_style || "未设置"}</dd>
              </div>
              <div className="flex justify-between border-b border-sand/60 py-2">
                <dt className="text-muted">目标平台</dt>
                <dd className="text-ink">{item.target_platform || "未设置"}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">创建时间</dt>
                <dd className="text-ink">{new Date(item.created_at).toLocaleString()}</dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={handleReanalyze} disabled={reanalyzing}>
                {reanalyzing ? "分析中..." : analysis ? "重新分析" : "生成分析报告"}
              </button>
              <button className="btn-secondary" type="button" onClick={handleDelete}>删除作品</button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-5">
        {analysisLoading ? (
          <div className="card">
            <p className="text-sm text-muted">正在加载分析结果…</p>
          </div>
        ) : analysis ? (
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
              onSubmit={handleChatSubmit}
            />
          </>
        ) : (
          <div className="card-soft text-center">
            <h2 className="font-display text-xl font-semibold">还没有分析报告</h2>
            <p className="mt-3 text-sm text-muted">
              点击上方「生成分析报告」，即可获得质量评分、修图参数与平台建议，并围绕这张照片继续追问。
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>
    </main>
  );
}
