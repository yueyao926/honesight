import { ChangeEvent, useEffect, useRef, useState } from "react";

export default function AvatarUploader({ onSave, onReset, onClose }: { onSave: (blob: Blob) => Promise<void>; onReset: () => Promise<void>; onClose: () => void }) {
  const [src, setSrc] = useState(""); const [zoom, setZoom] = useState(1); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("请选择 JPG、PNG 或 WEBP 图片");
    if (file.size > 5 * 1024 * 1024) return setError("图片不能超过 5MB");
    setError(""); setSrc(URL.createObjectURL(file)); setZoom(1);
  }
  async function crop() {
    const image = imageRef.current; if (!image) return;
    setBusy(true); setError("");
    try {
      const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("浏览器不支持图片裁剪");
      const base = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
      ctx.drawImage(image, (image.naturalWidth - base) / 2, (image.naturalHeight - base) / 2, base, base, 0, 0, 512, 512);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .88));
      if (!blob) throw new Error("图片处理失败"); await onSave(blob); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "上传失败"); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true">
    <div className="card w-full max-w-lg bg-cream">
      <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">更换头像</h2><button className="btn-ghost" onClick={onClose}>关闭</button></div>
      <input className="mt-6 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} />
      {src && <><div className="mx-auto mt-6 h-64 w-64 overflow-hidden rounded-full bg-sand"><img ref={imageRef} src={src} className="h-full w-full object-cover" style={{ transform: `scale(${zoom})` }} /></div><label className="mt-5 block text-sm">缩放 <input className="ml-3 w-48" type="range" min="1" max="2.5" step=".05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label></>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button className="btn-primary" disabled={!src || busy} onClick={crop}>{busy ? "上传中…" : "裁剪并保存"}</button><button className="btn-secondary" disabled={busy} onClick={async () => { setBusy(true); await onReset(); setBusy(false); onClose(); }}>恢复默认头像</button></div>
    </div>
  </div>;
}
