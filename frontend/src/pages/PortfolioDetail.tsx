import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { analyzePhoto, getLatestAnalysis } from "../api/analyze";
import { getAssetUrl } from "../api/client";
import { deletePortfolioItem, getPortfolioItem } from "../api/portfolio";
import type { Analysis, PortfolioItem } from "../types";

export default function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getPortfolioItem(id).then(setItem).catch((err) => setError(err.message));
    getLatestAnalysis(id).then(setAnalysis).catch(() => setAnalysis(null));
  }, [id]);

  const params = useMemo(() => {
    if (!analysis?.editing_params) return {};
    try {
      return JSON.parse(analysis.editing_params) as Record<string, string>;
    } catch {
      return {};
    }
  }, [analysis]);

  async function handleAnalyze() {
    if (!item) return;
    setLoading(true);
    try {
      const data = await analyzePhoto(item.id);
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm("确定删除这个作品吗？")) return;
    await deletePortfolioItem(id);
    navigate("/portfolio");
  }

  if (!item) {
    return <main className="container-page"><div className="card">{error || "加载中..."}</div></main>;
  }

  return (
    <main className="container-page">
      <Link className="text-sm text-brand" to="/portfolio">返回作品集</Link>
      <section className="mt-5 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card p-0">
          <img className="max-h-[620px] w-full rounded-2xl object-cover" src={getAssetUrl(item.image_url)} alt={item.title} />
        </div>
        <div className="space-y-5">
          <div className="card">
            <h1 className="text-3xl font-semibold">{item.title}</h1>
            <p className="mt-3 text-muted">{item.description || "暂无描述"}</p>
            <div className="mt-5 grid gap-3 text-sm text-muted md:grid-cols-2">
              <p>分类：{item.category || "-"}</p>
              <p>目标风格：{item.target_style || "-"}</p>
              <p>目标平台：{item.target_platform || "-"}</p>
              <p>创建时间：{new Date(item.created_at).toLocaleString()}</p>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>{loading ? "生成中..." : "生成分析报告"}</button>
              <button className="btn-secondary" onClick={handleDelete}>删除作品</button>
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          </div>
          <div className="card">
            <h2 className="text-2xl font-semibold">分析报告</h2>
            {!analysis ? (
              <p className="mt-4 text-muted">还没有分析报告，点击上方按钮生成。</p>
            ) : (
              <div className="mt-5 space-y-5 text-sm leading-7 text-muted">
                <p><span className="font-semibold text-ink">总体评价：</span>{analysis.summary}</p>
                <p><span className="font-semibold text-ink">构图建议：</span>{analysis.composition_advice}</p>
                <p><span className="font-semibold text-ink">光线建议：</span>{analysis.lighting_advice}</p>
                <p><span className="font-semibold text-ink">色彩建议：</span>{analysis.color_advice}</p>
                <div>
                  <p className="font-semibold text-ink">修图参数</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {Object.entries(params).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-soft px-4 py-3 text-ink">{key}: {value}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
