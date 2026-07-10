import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "../api/client";
import { listPortfolio } from "../api/portfolio";
import type { PortfolioItem } from "../types";

export default function Portfolio() {
  const [items, setItems] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    listPortfolio().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <main className="container-page">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end animate-fade-up">
        <div>
          <p className="section-eyebrow">Portfolio</p>
          <h1 className="page-title mt-2">我的作品集</h1>
          <p className="mt-3 text-muted">已保存的作品展示。新照片请先到 AI 工作室分析，满意后再收藏。</p>
        </div>
        <Link className="btn-secondary" to="/ai">去 AI 工作室</Link>
      </header>

      {items.length === 0 ? (
        <div className="card mt-10 text-center">
          <h2 className="font-display text-2xl font-semibold">还没有作品</h2>
          <p className="mt-3 text-sm text-muted">上传第一张照片，建立你的摄影成长档案。</p>
          <Link className="btn-primary mt-6 inline-block" to="/ai">去 AI 工作室</Link>
        </div>
      ) : (
        <div className="ins-grid mt-10">
          {items.map((item) => (
            <Link
              key={item.id}
              className="group overflow-hidden rounded-3xl bg-white/70 shadow-card transition hover:-translate-y-1"
              to={`/portfolio/${item.id}`}
            >
              <img
                className="h-64 w-full object-cover transition group-hover:scale-[1.02]"
                src={getAssetUrl(item.image_url)}
                alt={item.title}
              />
              <div className="p-5">
                <h2 className="font-display text-xl font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-muted">{item.category || "未分类"}</p>
                <span className="mt-3 inline-block text-xs text-brand-deep">查看详情 →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
