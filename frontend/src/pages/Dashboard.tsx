import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyPreferences } from "../api/preferences";
import { listPortfolio } from "../api/portfolio";
import DailyInspirationSection from "../components/DailyInspirationSection";
import type { PortfolioCollection, Preference } from "../types";

export default function Dashboard() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [collections, setCollections] = useState<PortfolioCollection[]>([]);

  useEffect(() => {
    Promise.allSettled([
      getMyPreferences().then(setPreference).catch(() => setPreference(null)),
      listPortfolio().then(setCollections).catch(() => setCollections([])),
    ]);
  }, []);

  return (
    <>
    <main className="container-page">
      <header className="animate-fade-up">
        <h1 className="max-w-3xl font-display text-3xl font-semibold leading-relaxed text-ink md:text-4xl">
          让每一次快门都有迹可循，也让光影里的进步慢慢成为你的作品。
        </h1>
      </header>

      <Link
        className="card group mt-8 flex animate-fade-up items-center justify-between gap-6 transition duration-300 hover:-translate-y-1"
        to="/ai"
      >
        <div className="max-w-3xl">
          <h2 className="font-display text-2xl font-semibold">让照片更接近你想要的样子</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            设定目标风格和发布平台，AI 会结合画面内容与个人偏好，分析构图、光线、色彩和风格匹配，并给出清晰可执行的调整建议。
          </p>
        </div>
        <span className="shrink-0 text-2xl text-brand-deep transition group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>

      <DailyInspirationSection embedded />

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card lg:h-[22rem]">
          <h2 className="font-display text-xl font-semibold">摄影偏好</h2>
          {preference ? (
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {[
                ["摄影水平", preference.skill_level],
                ["发布平台", preference.target_platform],
                ["偏好风格", preference.preferred_styles],
                ["常拍内容", preference.common_subjects],
                ["提升方向", preference.improvement_goals],
                ["修图工具", preference.editing_tools],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl bg-blush/30 px-4 py-3">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="mt-1 break-words text-ink">{value || "未设置"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-muted">还没有填写偏好。</p>
              <Link className="btn-secondary mt-4 inline-block" to="/onboarding">去填写</Link>
            </div>
          )}
        </div>

        <div className="card lg:h-[22rem] lg:overflow-hidden">
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
    </>
  );
}
