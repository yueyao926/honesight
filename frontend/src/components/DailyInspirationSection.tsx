import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { favoriteInspiration, getDailyInspirations, unfavoriteInspiration } from "../api/inspirations";
import { getAssetUrl } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import type { Inspiration } from "../types";

const INTERVAL = Number(import.meta.env.VITE_INSPIRATION_AUTOPLAY_INTERVAL_MS || 6000);

function InspirationArtwork({
  photo,
  className,
  eager = false,
}: {
  photo: Inspiration;
  className: string;
  eager?: boolean;
}) {
  const [source, setSource] = useState(getAssetUrl(photo.image_url));
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setSource(getAssetUrl(photo.image_url));
    setUnavailable(false);
  }, [photo.id, photo.image_url]);

  if (unavailable) {
    return (
      <span className={`${className} flex items-center justify-center bg-ink px-6 text-center text-sm text-white/65`}>
        图片暂时无法加载，仍可查看摄影赏析
      </span>
    );
  }

  return (
    <img
      src={source}
      alt={`${photo.title}，摄影：${photo.photographer_name}`}
      className={className}
      width={photo.width || 1200}
      height={photo.height || 800}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        const thumbnail = getAssetUrl(photo.thumbnail_url);
        if (thumbnail && thumbnail !== source) {
          setSource(thumbnail);
          return;
        }
        setUnavailable(true);
      }}
    />
  );
}

export default function DailyInspirationSection({ embedded = false }: { embedded?: boolean }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Inspiration[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [detail, setDetail] = useState<Inspiration | null>(null);
  const touchStart = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDailyInspirations();
      setItems(data);
      setIndex(0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "今日灵感加载失败");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (paused || detail || items.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % items.length), INTERVAL);
    return () => clearInterval(timer);
  }, [paused, detail, items.length]);

  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [detail]);

  const move = (step: number) => {
    if (items.length < 2) return;
    setIndex((value) => (value + step + items.length) % items.length);
  };

  async function toggleFavorite(photo: Inspiration) {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    const next = !photo.is_favorite;
    setItems((all) => all.map((item) => item.id === photo.id ? { ...item, is_favorite: next } : item));
    setDetail((item) => item?.id === photo.id ? { ...item, is_favorite: next } : item);
    try {
      next ? await favoriteInspiration(photo.id) : await unfavoriteInspiration(photo.id);
    } catch {
      setItems((all) => all.map((item) => item.id === photo.id ? { ...item, is_favorite: !next } : item));
      setDetail((item) => item?.id === photo.id ? { ...item, is_favorite: !next } : item);
    }
  }

  const sectionClass = embedded ? "py-10" : "container-page !py-12 sm:!py-14";

  if (loading) {
    return (
      <section className={sectionClass}>
        <div className="inspiration-skeleton" aria-label="正在加载今日摄影灵感" />
      </section>
    );
  }

  if (error || !items.length) {
    return (
      <section className={sectionClass}>
        <p className="section-eyebrow">今日摄影灵感</p>
        <div className="mt-4 rounded-3xl border border-sand bg-white/60 p-6 sm:p-8">
          <p className="text-sm leading-6 text-muted">{error || "今天的灵感正在路上，请稍后再来看看。"}</p>
          <button type="button" className="btn-secondary mt-5 !px-5 !py-2" onClick={() => void load()}>
            重新加载
          </button>
        </div>
      </section>
    );
  }

  const current = items[index];

  return (
    <>
      <section
        className={sectionClass}
        aria-label="今日摄影灵感轮播"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="mb-6 flex items-end justify-between gap-4 sm:mb-7">
          <div>
            <p className="section-eyebrow">Daily Inspiration</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">今日摄影灵感</h2>
            <p className="mt-2 text-sm text-muted">从一张好照片里，学习如何观察世界</p>
          </div>
          <div className="hidden items-end gap-5 sm:flex">
            <p className="text-xs tracking-widest text-muted">{String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</p>
            <Link to="/community" className="text-sm font-medium text-brand-deep transition hover:text-ink">发现更多作品 →</Link>
          </div>
        </div>

        <div
          className="inspiration-stage"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0].clientX;
            setPaused(true);
          }}
          onTouchEnd={(event) => {
            if (touchStart.current !== null) {
              const delta = event.changedTouches[0].clientX - touchStart.current;
              if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
            }
            touchStart.current = null;
            setPaused(false);
          }}
        >
          <button className="inspiration-image" type="button" onClick={() => setDetail(current)} aria-label={`查看${current.title}大图与摄影赏析`}>
            <InspirationArtwork key={current.id} photo={current} className="h-full w-full object-cover transition duration-500 hover:scale-[1.01]" eager={index === 0} />
          </button>
          <div className="inspiration-copy">
            <p className="font-display text-2xl italic leading-relaxed">“{current.poetic_caption}”</p>
            <p className="mt-4 text-sm leading-7 text-muted sm:mt-5">{current.recommendation_reason}</p>
            <div className="mt-6 flex flex-col items-start gap-4 text-xs text-muted sm:mt-7 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="leading-6">
                摄影：
                <a href={current.photographer_url} target="_blank" rel="noopener noreferrer" className="underline">{current.photographer_name}</a>
                {" · "}
                <a href={current.source_page_url} target="_blank" rel="noopener noreferrer" className="underline">{current.source_name}</a>
                {current.license_code ? ` · ${current.license_code}` : ""}
              </p>
              <button className="btn-secondary shrink-0 !px-4 !py-2" type="button" onClick={() => void toggleFavorite(current)} aria-label={current.is_favorite ? "取消收藏" : "收藏作品"}>
                {current.is_favorite ? "已收藏" : "收藏"}
              </button>
            </div>
          </div>
          {items.length > 1 && (
            <>
              <button className="carousel-arrow left-3" type="button" onClick={() => move(-1)} aria-label="上一张">←</button>
              <button className="carousel-arrow right-3" type="button" onClick={() => move(1)} aria-label="下一张">→</button>
            </>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between sm:justify-center">
          <Link to="/community" className="text-sm font-medium text-brand-deep sm:hidden">发现更多作品 →</Link>
          <div className="flex gap-2">
            {items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                className={`carousel-dot ${itemIndex === index ? "carousel-dot-active" : ""}`}
                onClick={() => setIndex(itemIndex)}
                aria-label={`转到第 ${itemIndex + 1} 张`}
                aria-current={itemIndex === index ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      </section>

      {detail && (
        <div className="inspiration-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="inspiration-title" className="inspiration-dialog">
            <button ref={closeRef} className="dialog-close" type="button" onClick={() => setDetail(null)} aria-label="关闭详情">×</button>
            <div className="h-[40vh] min-h-0 bg-ink sm:h-[44vh] md:h-auto">
              <InspirationArtwork photo={detail} className="h-full w-full object-contain" eager />
            </div>
            <aside className="max-h-[56vh] overflow-y-auto p-6 sm:p-7 md:max-h-none md:p-9">
              <p className="section-eyebrow">Photography Appreciation</p>
              <h3 id="inspiration-title" className="mt-2 font-display text-3xl font-semibold">{detail.title}</h3>
              <p className="mt-5 font-display text-xl italic leading-8">“{detail.poetic_caption}”</p>
              <Analysis title="整体赏析" text={detail.appreciation_summary} />
              <Analysis title="构图" text={detail.composition_analysis} />
              <Analysis title="光线" text={detail.light_analysis} />
              <Analysis title="色彩" text={detail.color_analysis} />
              <Analysis title="情绪与叙事" text={detail.emotion_analysis} />
              <Analysis title="学习提示" text={detail.learning_tip} />
              <button className="btn-primary mt-7 w-full" type="button" onClick={() => void toggleFavorite(detail)}>
                {detail.is_favorite ? "取消收藏" : "收藏这张作品"}
              </button>
              <p className="mt-6 text-xs leading-6 text-muted">
                {detail.attribution_text}
                <br />
                作品版权归原作者所有，本页面用于摄影学习与鉴赏。
              </p>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}

function Analysis({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 border-t border-sand pt-4">
      <h4 className="text-xs font-medium uppercase tracking-widest text-brand-deep">{title}</h4>
      <p className="mt-2 text-sm leading-7 text-muted">{text}</p>
    </div>
  );
}
