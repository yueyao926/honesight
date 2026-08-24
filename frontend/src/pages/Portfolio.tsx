import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPortfolio, listPortfolio } from "../api/portfolio";
import HandDrawnPressButton from "../components/HandDrawnPressButton";
import PortfolioCollectionCard from "../components/portfolio/PortfolioCollectionCard";
import PortfolioCollectionLoader from "../components/portfolio/PortfolioCollectionLoader";
import PortfolioTitleStars from "../components/portfolio/PortfolioTitleStars";
import OutlineLiftButton from "../components/ui/OutlineLiftButton";
import SquigglyText from "../components/ui/SquigglyText";
import photoSvg from "../SVG/photo.svg?url";
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
    <main className="handwriting-page container-page">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end animate-fade-up">
        <div>
          <p className="section-eyebrow">Portfolio</p>
          <h1 className="page-title mt-2 portfolio-page-title">
            我的作品集
            <PortfolioTitleStars />
          </h1>
          <p className="mt-3 max-w-2xl text-muted leading-7">
            <SquigglyText as="span" stepDuration={70} scale={[2, 3.5]} baseFrequency={0.018}>
              以风格为名，按时间收藏，或为一段特别的经历留下一册；让不同阶段的目光各自成篇，也让摄影的成长在多样的光影里清晰可见。
            </SquigglyText>
          </p>
        </div>
        <HandDrawnPressButton type="button" onClick={() => setShowCreate(true)}>
          新建作品集
        </HandDrawnPressButton>
      </header>

      {showCreate && (
        <form className="portfolio-inline-form mt-8" onSubmit={handleCreate}>
          <label className="sr-only" htmlFor="portfolio-name">作品集名称</label>
          <input
            id="portfolio-name"
            className="input portfolio-manage-rename-input min-w-0 flex-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：城市散步"
            maxLength={120}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
          />
          <OutlineLiftButton variant="solid" className="shrink-0" type="submit" disabled={creating}>
            {creating ? "创建中…" : "创建"}
          </OutlineLiftButton>
          <button
            className="btn-secondary portfolio-manage-cancel-btn shrink-0"
            type="button"
            onClick={() => setShowCreate(false)}
          >
            取消
          </button>
        </form>
      )}

      {error && <p className="mt-5 text-sm text-ink">{error}</p>}

      {collections.length === 0 ? (
        <div className="portfolio-empty mt-10">
          <img className="portfolio-empty-art" src={photoSvg} alt="" />
          <div>
            <h2 className="font-display text-2xl font-semibold">先创建一个空作品集</h2>
            <p className="mt-3 text-sm text-muted">只需要取一个名字，之后可以直接上传照片，或保存 AI 分析过的原图。</p>
          </div>
        </div>
      ) : (
        <div className="portfolio-collection-grid mt-10">
          <PortfolioCollectionLoader />
          {collections.map((collection) => (
            <PortfolioCollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}

      <div className="community-wall-footer">
        <Link className="community-wall-footer-link" to="/community">
          没有灵感？去看看大家的作品吧！ →
        </Link>
      </div>
    </main>
  );
}
