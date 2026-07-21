import { useEffect, useState } from "react";
import { getFavoriteInspirations, unfavoriteInspiration } from "../api/inspirations";
import type { Inspiration } from "../types";

export default function Community() {
  const [favorites, setFavorites] = useState<Inspiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getFavoriteInspirations().then(setFavorites).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function remove(photo: Inspiration) {
    const previous = favorites;
    setFavorites((items) => items.filter((item) => item.id !== photo.id));
    try { await unfavoriteInspiration(photo.id); }
    catch (e) { setFavorites(previous); setError(e instanceof Error ? e.message : "取消收藏失败"); }
  }

  return <main className="container-page">
    <header className="animate-fade-up">
      <p className="section-eyebrow">My Community</p>
      <h1 className="page-title mt-2">我的社区</h1>
      <p className="mt-3 text-muted">集中整理收藏与关注，慢慢建立属于你的摄影灵感网络。</p>
    </header>

    <nav className="mt-8 flex gap-2 border-b border-sand pb-3" aria-label="社区个人内容分类">
      <a className="rounded-full bg-brand px-5 py-2 text-sm text-white" href="#favorites">我的收藏</a>
      <a className="btn-ghost" href="#following">我的关注</a>
    </nav>

    <section id="favorites" className="pt-10">
      <div className="community-folder">
        <div><p className="text-xs uppercase tracking-[.18em] text-muted">Collection</p><h2 className="mt-2 font-display text-3xl font-semibold">首页灵感收藏夹</h2><p className="mt-2 text-sm text-muted">你在首页个性化推荐中收藏的摄影作品。</p></div>
        <strong className="font-display text-4xl text-brand-deep">{favorites.length}</strong>
      </div>
      {loading ? <div className="inspiration-skeleton mt-8 !h-64" aria-label="正在加载收藏" /> : error && favorites.length === 0 ? <p className="mt-8 rounded-3xl bg-white/60 p-7 text-sm text-muted">{error}</p> : favorites.length === 0 ? <div className="card mt-8 text-center"><h3 className="font-display text-2xl font-semibold">收藏夹还是空的</h3><p className="mt-3 text-sm text-muted">在首页灵感模块点击“收藏”，作品就会出现在这里。</p></div> : <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{favorites.map((photo) => <article key={photo.id} className="group overflow-hidden rounded-3xl bg-white/80 shadow-card"><a href={photo.source_page_url} target="_blank" rel="noopener noreferrer" aria-label={`查看 ${photo.title} 的原始页面`}><img className="h-72 w-full object-cover transition duration-500 group-hover:scale-[1.02]" src={photo.image_url} alt={`${photo.title}，摄影：${photo.photographer_name}`} width={photo.width || 1200} height={photo.height || 800} loading="lazy" decoding="async" /></a><div className="p-5"><h3 className="line-clamp-1 font-display text-xl font-semibold">{photo.title}</h3><p className="mt-2 text-xs text-muted">摄影：{photo.photographer_name} · {photo.source_name}</p><div className="mt-5 flex items-center justify-between"><span className="text-xs text-muted">{photo.license_code || "来源授权见原页面"}</span><button className="btn-ghost !px-3 !py-1.5" onClick={() => remove(photo)}>取消收藏</button></div></div></article>)}</div>}
    </section>

    <section id="following" className="mt-16 border-t border-sand pt-10">
      <p className="section-eyebrow">Following</p><h2 className="mt-2 font-display text-3xl font-semibold">我的关注</h2>
      <div className="mt-6 rounded-3xl border border-dashed border-brand/40 bg-white/40 p-8 text-sm leading-7 text-muted">社区作者、专题和摄影师关注将在社区内容发布功能上线后接入。当前先保留清晰入口，不创建虚假的关注数据。</div>
    </section>
  </main>;
}
