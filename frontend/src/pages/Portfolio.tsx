import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "../api/client";
import { createPortfolio, listPortfolio } from "../api/portfolio";
import type { PortfolioCollection } from "../types";

export default function Portfolio() {
  const [collections, setCollections] = useState<PortfolioCollection[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listPortfolio().then(setCollections).catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const collection = await createPortfolio(name.trim());
      setCollections((current) => [collection, ...current]);
      setName("");
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="container-page">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end animate-fade-up">
        <div>
          <p className="section-eyebrow">Portfolio</p>
          <h1 className="page-title mt-2">我的作品集</h1>
          <p className="mt-3 max-w-2xl text-muted">按自己的方式整理照片。作品集不做分类，也不展示评分和分析报告。</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setShowCreate(true)}>新建作品集</button>
      </header>

      {showCreate && (
        <form className="card mt-8 flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleCreate}>
          <div className="flex-1">
            <label className="label" htmlFor="portfolio-name">作品集名称</label>
            <input
              id="portfolio-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：城市散步"
              maxLength={120}
              autoFocus
              required
            />
          </div>
          <div className="flex gap-3">
            <button className="btn-primary" type="submit" disabled={creating}>{creating ? "创建中…" : "创建"}</button>
            <button className="btn-secondary" type="button" onClick={() => setShowCreate(false)}>取消</button>
          </div>
        </form>
      )}

      {error && <p className="mt-5 text-sm text-red-500">{error}</p>}

      {collections.length === 0 ? (
        <div className="card mt-10 text-center">
          <h2 className="font-display text-2xl font-semibold">先创建一个空作品集</h2>
          <p className="mt-3 text-sm text-muted">只需要取一个名字，之后可以直接上传照片，或保存 AI 分析过的原图。</p>
          <button className="btn-primary mt-6" type="button" onClick={() => setShowCreate(true)}>创建第一个作品集</button>
        </div>
      ) : (
        <div className="ins-grid mt-10">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              className="group overflow-hidden rounded-3xl bg-white/70 shadow-card transition hover:-translate-y-1"
              to={`/portfolio/${collection.id}`}
            >
              {collection.cover_image_url ? (
                <img
                  className="h-64 w-full object-cover transition group-hover:scale-[1.02]"
                  src={getAssetUrl(collection.cover_image_url)}
                  alt={collection.name}
                />
              ) : (
                <div className="flex h-64 items-center justify-center bg-blush/35">
                  <span className="font-display text-lg text-muted">空作品集</span>
                </div>
              )}
              <div className="p-5">
                <h2 className="font-display text-xl font-semibold">{collection.name}</h2>
                <p className="mt-2 text-sm text-muted">{collection.photo_count} 张照片</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
