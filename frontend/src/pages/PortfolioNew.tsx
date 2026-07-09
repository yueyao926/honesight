import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortfolioItem } from "../api/portfolio";
import { uploadImage } from "../api/upload";

export default function PortfolioNew() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const file = form.get("image") as File;
    try {
      if (!file || file.size === 0) throw new Error("请选择图片");
      const uploaded = await uploadImage(file);
      const item = await createPortfolioItem({
        title: String(form.get("title")),
        description: String(form.get("description") || ""),
        image_url: uploaded.image_url,
        category: String(form.get("category") || ""),
        target_style: String(form.get("target_style") || ""),
        target_platform: String(form.get("target_platform") || ""),
      });
      navigate(`/portfolio/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container-page max-w-3xl">
      <div className="card">
        <h1 className="text-3xl font-semibold">上传新作品</h1>
        <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
          <div><label className="label">上传图片</label><input className="input" name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
          <div><label className="label">标题</label><input className="input" name="title" required /></div>
          <div><label className="label">描述</label><textarea className="input min-h-28" name="description" /></div>
          <div className="grid gap-5 md:grid-cols-3">
            <div><label className="label">分类</label><input className="input" name="category" placeholder="人像 / 美食" /></div>
            <div><label className="label">目标风格</label><input className="input" name="target_style" placeholder="清新自然" /></div>
            <div><label className="label">目标平台</label><input className="input" name="target_platform" placeholder="小红书" /></div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" disabled={isSubmitting} type="submit">{isSubmitting ? "上传中..." : "创建作品"}</button>
        </form>
      </div>
    </main>
  );
}
