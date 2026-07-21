import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyPreferences } from "../api/preferences";
import { listPortfolio } from "../api/portfolio";
import { useAuth } from "../contexts/AuthContext";
import DailyInspirationSection from "../components/DailyInspirationSection";
import type { PortfolioItem, Preference } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      getMyPreferences().then(setPreference).catch(() => setPreference(null)),
      listPortfolio().then(setItems).catch(() => setItems([])),
    ]).finally(() => setLoaded(true));
  }, []);

  // 根据用户当前状态，给出唯一明确的下一步
  const nextStep = !preference
    ? { title: "先填写摄影偏好", desc: "花 1 分钟告诉我们你的水平和目标，分析报告会更贴合你。", cta: "去填写偏好", link: "/onboarding" }
    : items.length === 0
      ? { title: "分析你的第一张照片", desc: "上传照片、选好目标风格，AI 立刻给出修改建议与预期效果。", cta: "开始 AI 分析", link: "/ai" }
      : { title: "继续打磨你的作品", desc: "上传新照片获取建议，或回到作品集围绕已保存的照片继续追问。", cta: "开始 AI 分析", link: "/ai" };

  return (
    <>
    <main className="container-page">
      <header className="animate-fade-up">
        <p className="section-eyebrow">Dashboard</p>
        <h1 className="page-title mt-2">你好，{user?.username}</h1>
        <p className="mt-4 text-muted">先上传照片获取 AI 建议，满意后再保存到作品集。</p>
      </header>

      <DailyInspirationSection embedded />

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
    </>
  );
}
