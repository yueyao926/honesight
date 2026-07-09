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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">我的作品集</h1>
          <p className="mt-3 text-muted">记录每张作品的目标、分析和成长路径。</p>
        </div>
        <Link className="btn-primary" to="/portfolio/new">上传第一张照片</Link>
      </div>
      {items.length === 0 ? (
        <div className="card mt-8 text-center">
          <h2 className="text-2xl font-semibold">还没有作品</h2>
          <p className="mt-3 text-muted">上传第一张照片，生成你的第一份摄影建议报告。</p>
          <Link className="mt-6 inline-block btn-primary" to="/portfolio/new">去上传</Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} className="card overflow-hidden p-0" to={`/portfolio/${item.id}`}>
              <img className="h-56 w-full object-cover" src={getAssetUrl(item.image_url)} alt={item.title} />
              <div className="p-5">
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-muted">{item.category || "未分类"} · {item.target_style || "未设置风格"}</p>
                <p className="mt-1 text-sm text-muted">目标平台：{item.target_platform || "未设置"}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
