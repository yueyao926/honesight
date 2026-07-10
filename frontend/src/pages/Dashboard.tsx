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
      <header className="animate-fade-up">
        <p className="section-eyebrow">Dashboard</p>
        <h1 className="page-title mt-2">你好，{user?.username}</h1>
        <p className="mt-4 text-muted">先上传照片获取 AI 建议，满意后再保存到作品集。</p>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          { label: "已上传作品", value: items.length },
          { label: "主要平台", value: preference?.target_platform || "未设置" },
          { label: "偏好风格", value: preference?.preferred_styles || "未设置" },
        ].map((stat) => (
          <div key={stat.label} className="card-soft">
            <p className="text-xs uppercase tracking-widest text-muted">{stat.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 flex flex-wrap gap-4">
        <Link className="btn-primary" to="/ai">开始 AI 分析</Link>
        <Link className="btn-ghost" to="/portfolio">查看作品集</Link>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="font-display text-xl font-semibold">摄影偏好</h2>
          {preference ? (
            <dl className="mt-5 space-y-2 text-sm text-muted">
              <p>水平：{preference.skill_level || "-"}</p>
              <p>常拍：{preference.common_subjects || "-"}</p>
              <p>目标：{preference.improvement_goals || "-"}</p>
            </dl>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-muted">还没有填写偏好。</p>
              <Link className="btn-secondary mt-4 inline-block" to="/onboarding">去填写</Link>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-display text-xl font-semibold">最近作品</h2>
          {items.length === 0 ? (
            <p className="mt-5 text-sm text-muted">还没有作品，去上传第一张照片。</p>
          ) : (
            <div className="mt-5 space-y-3">
              {items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-blush/30 px-4 py-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted">{item.target_style || "未设置风格"}</p>
                  </div>
                  <Link className="text-xs text-brand-deep" to={`/portfolio/${item.id}`}>查看 →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
