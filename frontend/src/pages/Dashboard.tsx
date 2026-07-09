import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyPreferences } from "../api/preferences";
import { listPortfolio } from "../api/portfolio";
import { useAuth } from "../contexts/AuthContext";
import type { PortfolioItem, Preference } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    getMyPreferences().then(setPreference).catch(() => setPreference(null));
    listPortfolio().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <main className="container-page">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold text-brand">欢迎回来</p>
          <h1 className="mt-2 text-4xl font-semibold">{user?.username}</h1>
          <p className="mt-3 text-muted">继续积累作品，LensCoach 会帮你把每次拍摄变成下一次进步。</p>
        </div>
        <div className="flex gap-3">
          <Link className="btn-primary" to="/portfolio/new">上传新作品</Link>
          <Link className="btn-secondary" to="/portfolio">查看作品集</Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="card"><p className="text-sm text-muted">已上传作品</p><p className="mt-2 text-4xl font-semibold">{items.length}</p></div>
        <div className="card"><p className="text-sm text-muted">主要平台</p><p className="mt-2 text-2xl font-semibold">{preference?.target_platform || "未设置"}</p></div>
        <div className="card"><p className="text-sm text-muted">偏好风格</p><p className="mt-2 text-2xl font-semibold">{preference?.preferred_styles || "未设置"}</p></div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card">
          <h2 className="text-xl font-semibold">当前摄影偏好</h2>
          {preference ? (
            <dl className="mt-5 space-y-3 text-sm text-muted">
              <p>水平：{preference.skill_level || "-"}</p>
              <p>常拍：{preference.common_subjects || "-"}</p>
              <p>目标：{preference.improvement_goals || "-"}</p>
              <p>工具：{preference.editing_tools || "-"}</p>
            </dl>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-muted">你还没有填写偏好。</p>
              <Link className="mt-4 inline-block btn-secondary" to="/onboarding">去填写</Link>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold">最近作品</h2>
          {items.length === 0 ? (
            <p className="mt-5 text-sm text-muted">还没有作品，去上传第一张照片。</p>
          ) : (
            <div className="mt-5 grid gap-3">
              {items.slice(0, 3).map((item) => (
                <Link key={item.id} className="rounded-xl border border-slate-200 p-4 hover:border-brand" to={`/portfolio/${item.id}`}>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">{item.category} · {item.target_style} · {item.target_platform}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
