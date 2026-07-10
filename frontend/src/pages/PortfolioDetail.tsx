import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAssetUrl } from "../api/client";
import { deletePortfolioItem, getPortfolioItem } from "../api/portfolio";
import type { PortfolioItem } from "../types";

export default function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getPortfolioItem(id)
      .then(setItem)
      .catch((err) => setError(err.message));
  }, [id]);

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
              <Link className="btn-secondary" to="/portfolio">返回作品集</Link>
              <button className="btn-secondary" type="button" onClick={handleDelete}>删除作品</button>
            </div>
          </div>

          <div className="card-soft">
            <p className="text-sm leading-7 text-muted">
              这是已保存到作品集的作品。想分析新照片？前往
              <Link className="mx-1 text-brand-deep" to="/ai">AI 工作室</Link>
              上传照片和风格参考，满意后再收藏。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
