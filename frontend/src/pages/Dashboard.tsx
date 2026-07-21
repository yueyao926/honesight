import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyPreferences } from "../api/preferences";
import { listPortfolio } from "../api/portfolio";
import { useAuth } from "../contexts/AuthContext";
import type { PortfolioCollection, Preference } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [collections, setCollections] = useState<PortfolioCollection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      getMyPreferences().then(setPreference).catch(() => setPreference(null)),
      listPortfolio().then(setCollections).catch(() => setCollections([])),
    ]).finally(() => setLoaded(true));
  }, []);

  const photoCount = collections.reduce((sum, collection) => sum + collection.photo_count, 0);
  const nextStep = !preference
    ? { title: "先填写摄影偏好", desc: "花 1 分钟告诉我们你的水平和目标，分析报告会更贴合你。", cta: "去填写偏好", link: "/onboarding" }
    : collections.length === 0
      ? { title: "创建第一个作品集", desc: "只需要取一个名字，就能开始整理自己的照片。", cta: "创建作品集", link: "/portfolio" }
      : { title: "继续整理或分析照片", desc: "直接上传原图到作品集，或让 AI 先给出建议再决定是否收藏原图。", cta: "开始 AI 分析", link: "/ai" };

  return (
    <main className="container-page">
      <header className="animate-fade-up">
        <p className="section-eyebrow">Dashboard</p>
        <h1 className="page-title mt-2">你好，{user?.username}</h1>
        <p className="mt-4 text-muted">整理原图与获取 AI 建议是两件独立的事，按你当下的需要选择即可。</p>
      </header>

      {loaded && (
        <section className="card mt-8 animate-fade-up flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="section-eyebrow">下一步</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">{nextStep.title}</h2>
            <p className="mt-2 text-sm text-muted">{nextStep.desc}</p>
          </div>
          <Link className="btn-primary shrink-0" to={nextStep.link}>{nextStep.cta}</Link>
        </section>
      )}

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          { label: "作品集", value: collections.length },
          { label: "已保存照片", value: photoCount },
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
        <Link className="btn-ghost" to="/portfolio">管理作品集</Link>
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
          <h2 className="font-display text-xl font-semibold">最近作品集</h2>
          {collections.length === 0 ? (
            <p className="mt-5 text-sm text-muted">还没有作品集，先创建一个空作品集。</p>
          ) : (
            <div className="mt-5 space-y-3">
              {collections.slice(0, 3).map((collection) => (
                <div key={collection.id} className="flex items-center justify-between rounded-2xl bg-blush/30 px-4 py-3">
                  <div>
                    <p className="font-medium">{collection.name}</p>
                    <p className="text-xs text-muted">{collection.photo_count} 张照片</p>
                  </div>
                  <Link className="text-xs text-brand-deep" to={`/portfolio/${collection.id}`}>打开 →</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
