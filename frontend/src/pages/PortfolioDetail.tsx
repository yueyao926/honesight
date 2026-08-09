import { FormEvent, useEffect, useState } from "react";
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
import type { PortfolioCollectionDetail, PortfolioPhoto } from "../types";

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
      <main className="container-page">
        <Link className="text-sm text-brand-deep" to="/portfolio">← 返回作品集</Link>
        <div className="card mt-8 text-center text-sm text-muted">{error || "加载中…"}</div>
      </main>
    );
  }

  return (
    <main className="container-page">
      <Link className="text-sm text-brand-deep" to="/portfolio">← 返回作品集</Link>

      <header className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="section-eyebrow">Portfolio</p>
          <h1 className="page-title mt-2">{collection.name}</h1>
          <p className="mt-3 text-sm text-muted">{collection.photo_count} 张照片</p>
        </div>
        <button className={managing ? "btn-primary" : "btn-secondary"} type="button" onClick={() => setManaging((value) => !value)}>
          {managing ? "完成管理" : "管理作品集"}
        </button>
      </header>

      {managing && (
        <section className="card mt-8 space-y-7">
          <div>
            <h2 className="font-display text-2xl font-semibold">添加照片</h2>
            <p className="mt-2 text-sm text-muted">可上传原图，或你根据建议自行调整后的作品。</p>
            <div className="mt-5 max-w-xl">
              <PhotoUpload value={uploadUrl} onChange={setUploadUrl} label="选择要加入的原图" />
            </div>
            {uploadUrl && <button className="btn-primary mt-4" type="button" onClick={handleAddPhoto} disabled={saving}>{saving ? "添加中…" : "加入作品集"}</button>}
          </div>

          <div className="border-t border-sand/60 pt-6">
            {!renaming ? (
              <div className="flex flex-wrap gap-3">
                <button className="btn-secondary" type="button" onClick={() => setRenaming(true)}>重命名</button>
                <button className="btn-ghost text-red-500" type="button" onClick={handleDeleteCollection}>删除作品集</button>
              </div>
            ) : (
              <form className="flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={handleRename}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
                <button className="btn-primary shrink-0" type="submit" disabled={saving}>保存名称</button>
                <button className="btn-secondary shrink-0" type="button" onClick={() => setRenaming(false)}>取消</button>
              </form>
            )}
          </div>
        </section>
      )}

      {error && <p className="mt-5 text-sm text-red-500">{error}</p>}

      {collection.photos.length === 0 ? (
        <div className="card mt-10 text-center">
          <h2 className="font-display text-2xl font-semibold">这个作品集还是空的</h2>
          <p className="mt-3 text-sm text-muted">打开管理功能上传作品，或从 AI 工作室保存原图和 AI 精修版本。</p>
          {!managing && <button className="btn-primary mt-6" type="button" onClick={() => setManaging(true)}>添加照片</button>}
        </div>
      ) : (
        <div className="ins-grid mt-10">
          {collection.photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-3xl bg-white shadow-card">
              <button className="block w-full" type="button" onClick={() => !managing && setSelectedPhoto(photo)}>
                <img className="h-72 w-full object-cover transition group-hover:scale-[1.02]" src={getAssetUrl(photo.thumbnail_url || photo.image_url)} alt="作品照片" loading="lazy" decoding="async" />
              </button>
              <span className="absolute bottom-3 left-3 rounded-full bg-ink/75 px-3 py-1 text-xs text-white">
                {sourceLabels[photo.source] || "作品"}
              </span>
              {managing && (
                <button
                  className="absolute right-3 top-3 rounded-full bg-ink/80 px-4 py-2 text-xs text-white"
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
