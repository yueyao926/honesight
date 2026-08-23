import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAssetUrl } from "../api/client";
import {
  addPortfolioPhoto,
  deletePortfolio,
  deletePortfolioPhoto,
  getPortfolio,
  renamePortfolio,
} from "../api/portfolio";
import PhotoUpload from "../components/PhotoUpload";
import PortfolioStarButton from "../components/portfolio/PortfolioStarButton";
import OutlineLiftButton from "../components/ui/OutlineLiftButton";
import PillShiftButton from "../components/ui/PillShiftButton";
import type { PortfolioCollectionDetail, PortfolioPhoto } from "../types";
import portrait2Svg from "../SVG/人像2.svg?url";
import portrait3Svg from "../SVG/人像3.svg?url";
import portrait4Svg from "../SVG/人像4.svg?url";
import portrait5Svg from "../SVG/人像5.svg?url";
import portraitAvatarSvg from "../SVG/人像头像.svg?url";
import vectorBorderSvg from "../SVG/Vector.svg?url";
import cameraPersonPng from "../SVG/拍照的人.png";

const PORTFOLIO_PORTRAIT_SVGS = [
  portrait2Svg,
  portrait3Svg,
  portrait4Svg,
  portrait5Svg,
  portraitAvatarSvg,
];

function pickRandomPortfolioPortrait() {
  return PORTFOLIO_PORTRAIT_SVGS[Math.floor(Math.random() * PORTFOLIO_PORTRAIT_SVGS.length)];
}

const sourceLabels: Record<string, string> = {
  direct_upload: "直接上传",
  ai_original: "原图",
  ai_refined: "AI 精修",
  user_improved: "自主改进",
};

export default function PortfolioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<PortfolioCollectionDetail | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PortfolioPhoto | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [portraitArt, setPortraitArt] = useState(PORTFOLIO_PORTRAIT_SVGS[0]);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const previewSlotRef = useRef<HTMLDivElement>(null);
  const [panelPreviewMaxHeight, setPanelPreviewMaxHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    if (!managing || !uploadUrl) {
      setPanelPreviewMaxHeight(undefined);
      return;
    }

    const slot = previewSlotRef.current;
    const body = panelBodyRef.current;
    if (!slot) return;

    const measure = () => {
      setPanelPreviewMaxHeight(Math.max(72, slot.clientHeight));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    if (body) observer.observe(body);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [managing, uploadUrl, renaming]);

  useEffect(() => {
    setPortraitArt(pickRandomPortfolioPortrait());
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getPortfolio(id)
      .then((data) => {
        setCollection(data);
        setName(data.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, [id]);

  async function handleAddPhoto() {
    if (!id || !uploadUrl) return;
    setSaving(true);
    setError("");
    try {
      const photo = await addPortfolioPhoto(id, { image_url: uploadUrl });
      setCollection((current) => current ? {
        ...current,
        photos: [photo, ...current.photos],
        photo_count: current.photo_count + 1,
        cover_image_url: photo.thumbnail_url || photo.image_url,
      } : current);
      setUploadUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePhoto(photo: PortfolioPhoto) {
    if (!id || !window.confirm("从这个作品集中删除这张照片？")) return;
    setError("");
    try {
      await deletePortfolioPhoto(id, photo.id);
      setCollection((current) => {
        if (!current) return current;
        const photos = current.photos.filter((item) => item.id !== photo.id);
        return { ...current, photos, photo_count: photos.length, cover_image_url: photos[0]?.thumbnail_url || photos[0]?.image_url || null };
      });
      if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const updated = await renamePortfolio(id, name.trim());
      setCollection((current) => current ? { ...current, ...updated, photos: current.photos } : current);
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重命名失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCollection() {
    if (!id || !collection || !window.confirm(`删除作品集“${collection.name}”及其中全部照片记录？`)) return;
    try {
      await deletePortfolio(id);
      navigate("/portfolio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  if (!collection) {
    return (
      <main className="handwriting-page container-page">
        <Link className="text-sm text-ink" to="/portfolio">← 返回作品集</Link>
        <div className="card mt-8 text-center text-sm text-muted">{error || "加载中…"}</div>
      </main>
    );
  }

  return (
    <main className="handwriting-page container-page">
      <Link className="text-sm text-ink" to="/portfolio">← 返回作品集</Link>

      <header className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="portfolio-detail-header">
          <div className="portfolio-detail-header__inner">
            <div className="portfolio-detail-header__text-stack">
              <p className="section-eyebrow">Portfolio</p>
              <h1 className="page-title">{collection.name}</h1>
              <p className="portfolio-detail-header__meta text-sm text-muted">
                {collection.photo_count} 张照片
              </p>
            </div>
            <img
              src={portraitArt}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="portfolio-title-portrait"
            />
          </div>
        </div>
        <PortfolioStarButton type="button" onClick={() => setManaging((value) => !value)}>
          {managing ? "完成管理" : "管理作品集"}
        </PortfolioStarButton>
      </header>

      {managing && (
        <section className="portfolio-manage-panel">
          <div className="portfolio-manage-panel__frame portfolio-manage-panel__frame--stage">
            <div className="portfolio-manage-panel__inner">
              <div className="portfolio-manage-panel__body" ref={panelBodyRef}>
                <header className="portfolio-manage-panel__header">
                  <div className="portfolio-manage-panel__title-row">
                    <h2 className="font-display text-2xl font-semibold">添加照片</h2>
                    <div className="portfolio-manage-panel__loader" aria-hidden="true" />
                  </div>
                  <p className="mt-2 max-w-md text-sm text-muted">可上传原图，或你根据建议自行调整后的作品。</p>
                </header>

                <div
                  className={`portfolio-manage-panel__main${uploadUrl ? " portfolio-manage-panel__main--with-preview" : ""}`}
                >
                  <div ref={previewSlotRef} className="portfolio-manage-panel__preview-slot">
                    <PhotoUpload
                      value={uploadUrl}
                      onChange={setUploadUrl}
                      label="选择要加入的原图"
                      purpose="portfolio"
                      outlineOnly
                      compactPreview
                      previewMaxHeight={panelPreviewMaxHeight}
                    />
                  </div>
                  {uploadUrl && (
                    <PillShiftButton
                      className="portfolio-manage-panel__add-btn shrink-0"
                      type="button"
                      onClick={handleAddPhoto}
                      disabled={saving}
                    >
                      {saving ? "添加中…" : "加入作品集"}
                    </PillShiftButton>
                  )}
                </div>

                <div className="portfolio-manage-panel__footer">
                  {!renaming ? (
                    <div className="flex flex-wrap gap-3">
                      <OutlineLiftButton type="button" onClick={() => setRenaming(true)}>重命名</OutlineLiftButton>
                      <button className="btn-ghost text-ink" type="button" onClick={handleDeleteCollection}>删除作品集</button>
                    </div>
                  ) : (
                    <form className="portfolio-inline-form" onSubmit={handleRename}>
                      <input
                        className="input portfolio-manage-rename-input min-w-0 flex-1"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={120}
                        required
                      />
                      <OutlineLiftButton variant="solid" className="shrink-0" type="submit" disabled={saving}>
                        {saving ? "保存中…" : "保存名称"}
                      </OutlineLiftButton>
                      <button className="btn-secondary portfolio-manage-cancel-btn shrink-0" type="button" onClick={() => setRenaming(false)}>取消</button>
                    </form>
                  )}
                </div>
              </div>
              <img
                src={cameraPersonPng}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="portfolio-manage-panel__art"
              />
            </div>
            <img
              src={vectorBorderSvg}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="portfolio-manage-panel__border"
            />
          </div>
        </section>
      )}

      {error && <p className="mt-5 text-sm text-ink">{error}</p>}

      {collection.photos.length === 0 ? (
        <div className="card mt-10 text-center">
          <h2 className="font-display text-2xl font-semibold">这个作品集还是空的</h2>
          <p className="mt-3 text-sm text-muted">打开管理功能上传作品，或从 AI 工作室保存原图和 AI 精修版本。</p>
          {!managing && <button className="btn-primary mt-6" type="button" onClick={() => setManaging(true)}>添加照片</button>}
        </div>
      ) : (
        <div className="portfolio-detail-grid mt-10">
          {collection.photos.map((photo) => (
            <div key={photo.id} className="portfolio-photo-card group relative overflow-hidden rounded-2xl bg-white shadow-card">
              <button className="block w-full" type="button" onClick={() => !managing && setSelectedPhoto(photo)}>
                <img className="aspect-square w-full object-cover transition group-hover:scale-[1.02]" src={getAssetUrl(photo.thumbnail_url || photo.image_url)} alt="作品照片" loading="lazy" decoding="async" />
              </button>
              <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2.5 py-0.5 text-[0.6875rem] text-white">
                {sourceLabels[photo.source] || "作品"}
              </span>
              {managing && (
                <button
                  className="absolute right-2 top-2 rounded-full bg-ink/80 px-3 py-1.5 text-[0.6875rem] text-white"
                  type="button"
                  onClick={() => handleDeletePhoto(photo)}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/90 p-4" role="dialog" aria-modal="true" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute right-5 top-5 rounded-full bg-white/15 px-4 py-2 text-sm text-white" type="button" onClick={() => setSelectedPhoto(null)}>关闭</button>
          <img
            className="max-h-[92vh] max-w-[94vw] object-contain"
            src={getAssetUrl(selectedPhoto.image_url)}
            alt="放大的作品照片"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
