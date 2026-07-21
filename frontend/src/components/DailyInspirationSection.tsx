import { useEffect, useRef, useState } from "react";
import { favoriteInspiration, getDailyInspirations, unfavoriteInspiration } from "../api/inspirations";
import { useAuth } from "../contexts/AuthContext";
import type { Inspiration } from "../types";

const INTERVAL = Number(import.meta.env.VITE_INSPIRATION_AUTOPLAY_INTERVAL_MS || 6000);

export default function DailyInspirationSection({ embedded = false }: { embedded?: boolean }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Inspiration[]>([]); const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [paused, setPaused] = useState(false); const [detail, setDetail] = useState<Inspiration | null>(null);
  const touchStart = useRef<number | null>(null); const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { getDailyInspirations().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [isAuthenticated]);
  useEffect(() => {
    if (paused || detail || items.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), INTERVAL);
    return () => clearInterval(timer);
  }, [paused, detail, items.length, index]);
  useEffect(() => {
    if (!detail) return; closeRef.current?.focus(); const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDetail(null); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [detail]);

  const move = (step: number) => { setIndex((value) => (value + step + items.length) % items.length); };
  async function toggleFavorite(photo: Inspiration) {
    if (!isAuthenticated) { window.location.href = "/login"; return; }
    const next = !photo.is_favorite; setItems((all) => all.map((x) => x.id === photo.id ? { ...x, is_favorite: next } : x));
    setDetail((x) => x?.id === photo.id ? { ...x, is_favorite: next } : x);
    try { next ? await favoriteInspiration(photo.id) : await unfavoriteInspiration(photo.id); }
    catch { setItems((all) => all.map((x) => x.id === photo.id ? { ...x, is_favorite: !next } : x)); setDetail((x) => x?.id === photo.id ? { ...x, is_favorite: !next } : x); }
  }

  const sectionClass = embedded ? "py-10" : "container-page py-14";
  if (loading) return <section className={sectionClass}><div className="inspiration-skeleton" aria-label="正在加载今日摄影灵感" /></section>;
  if (error || !items.length) return <section className={sectionClass}><p className="section-eyebrow">今日摄影灵感</p><div className="mt-4 rounded-3xl border border-sand bg-white/60 p-8 text-sm text-muted">{error || "今天的灵感正在路上，请稍后再来看看。"}</div></section>;
  const current = items[index];
  return <>
    <section className={sectionClass} aria-label="今日摄影灵感轮播" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      <div className="mb-7 flex items-end justify-between gap-4"><div><p className="section-eyebrow">Daily Inspiration</p><h2 className="mt-2 font-display text-4xl font-semibold">今日摄影灵感</h2><p className="mt-2 text-sm text-muted">从一张好照片里，学习如何观察世界</p></div><p className="hidden text-xs tracking-widest text-muted md:block">{String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</p></div>
      <div className="inspiration-stage" onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; setPaused(true); }} onTouchEnd={(e) => { if (touchStart.current !== null) { const delta = e.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1); } touchStart.current = null; setPaused(false); }}>
        <button className="inspiration-image" onClick={() => setDetail(current)} aria-label={`查看${current.title}大图与摄影赏析`}><img src={current.image_url} alt={`${current.title}，摄影：${current.photographer_name}`} width={current.width || 1200} height={current.height || 800} loading={index === 0 ? "eager" : "lazy"} decoding="async" onError={(e) => { e.currentTarget.style.opacity = ".15"; }} /></button>
        <div className="inspiration-copy"><p className="font-display text-2xl italic leading-relaxed">“{current.poetic_caption}”</p><p className="mt-5 text-sm leading-7 text-muted">{current.recommendation_reason}</p><div className="mt-7 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><p>摄影：<a href={current.photographer_url} target="_blank" rel="noopener noreferrer" className="underline">{current.photographer_name}</a> · <a href={current.source_page_url} target="_blank" rel="noopener noreferrer" className="underline">{current.source_name}</a>{current.license_code ? ` · ${current.license_code}` : ""}</p><button className="btn-secondary !px-4 !py-2" onClick={() => toggleFavorite(current)} aria-label={current.is_favorite ? "取消收藏" : "收藏作品"}>{current.is_favorite ? "已收藏" : "收藏"}</button></div></div>
        <button className="carousel-arrow left-3" onClick={() => move(-1)} aria-label="上一张">←</button><button className="carousel-arrow right-3" onClick={() => move(1)} aria-label="下一张">→</button>
      </div>
      <div className="mt-5 flex justify-center gap-2">{items.map((item, i) => <button key={item.id} className={`carousel-dot ${i === index ? "carousel-dot-active" : ""}`} onClick={() => setIndex(i)} aria-label={`转到第 ${i + 1} 张`} aria-current={i === index ? "true" : undefined} />)}</div>
    </section>
    {detail && <div className="inspiration-dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}><div role="dialog" aria-modal="true" aria-labelledby="inspiration-title" className="inspiration-dialog"><button ref={closeRef} className="dialog-close" onClick={() => setDetail(null)} aria-label="关闭详情">×</button><div className="min-h-0 bg-neutral-900"><img src={detail.image_url} alt={`${detail.title}，摄影：${detail.photographer_name}`} className="h-full max-h-[88vh] w-full object-contain" /></div><aside className="overflow-y-auto p-7 md:p-9"><p className="section-eyebrow">Photography Appreciation</p><h3 id="inspiration-title" className="mt-2 font-display text-3xl font-semibold">{detail.title}</h3><p className="mt-5 font-display text-xl italic leading-8">“{detail.poetic_caption}”</p><Analysis title="整体赏析" text={detail.appreciation_summary}/><Analysis title="构图" text={detail.composition_analysis}/><Analysis title="光线" text={detail.light_analysis}/><Analysis title="色彩" text={detail.color_analysis}/><Analysis title="情绪与叙事" text={detail.emotion_analysis}/><Analysis title="学习提示" text={detail.learning_tip}/><button className="btn-primary mt-7 w-full" onClick={() => toggleFavorite(detail)}>{detail.is_favorite ? "取消收藏" : "收藏这张作品"}</button><p className="mt-6 text-xs leading-6 text-muted">{detail.attribution_text}<br/>作品版权归原作者所有，本页面用于摄影学习与鉴赏。</p></aside></div></div>}
  </>;
}

function Analysis({ title, text }: { title: string; text: string }) { return <div className="mt-6 border-t border-sand pt-4"><h4 className="text-xs font-medium uppercase tracking-widest text-brand-deep">{title}</h4><p className="mt-2 text-sm leading-7 text-muted">{text}</p></div>; }
