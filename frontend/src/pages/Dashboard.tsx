import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCurrentPractice } from "../api/practice";
import DailyInspirationSection from "../components/DailyInspirationSection";
import { useAuth } from "../contexts/AuthContext";
import type { PracticeSession } from "../types";

export default function Dashboard() {
  const { user } = useAuth();
  const [practice, setPractice] = useState<PracticeSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentPractice()
      .then(setPractice)
      .catch((err) => setError(err instanceof Error ? err.message : "无法载入本周练习"));
  }, []);

  const actionLabel = practice?.status === "completed"
    ? "查看本周成长对比"
    : practice?.progress === 1
      ? "提交复拍，完成闭环"
      : "开始第一次拍摄";

  return (
    <main>
      <section className="container-page !py-6 sm:!py-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-9 text-white sm:px-9 sm:py-12 lg:px-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sage/45 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="font-display text-sm italic tracking-wide text-rose">
              {user?.username ? `${user.username}，` : ""}本周只练一件事
            </p>
            <h1 className="mt-3 font-display text-[2.35rem] font-semibold leading-[1.08] sm:text-5xl">
              {practice?.title || "正在为你准备本周摄影练习"}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
              {practice?.brief || "练习会结合你的摄影目标，只给一个清晰、可以复拍验证的动作。"}
            </p>
            {practice && (
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-ink transition hover:bg-blush" to="/practice">
                  {actionLabel}
                </Link>
                <span className="text-sm text-white/60">练习进度 {practice.progress}/2 · 重点 {practice.skill_focus}</span>
              </div>
            )}
            {error && <p className="mt-5 text-sm text-red-300">{error}</p>}
          </div>
        </div>
      </section>

      {practice && (
        <section className="container-page !pb-8 !pt-2">
          <div className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
            <div className="card">
              <p className="section-eyebrow">教练记得你上一次做到哪里</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">当前提醒</h2>
              <p className="mt-4 text-sm leading-7 text-muted">{practice.coach_note}</p>
              <Link className="mt-5 inline-flex text-sm font-medium text-brand-deep" to="/practice">继续练习 →</Link>
            </div>
            <div className="card-soft">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">本周闭环</p>
              <p className="mt-3 font-display text-5xl font-semibold text-ink">{practice.progress}/2</p>
              <div className="mt-4 h-2 rounded-full bg-sand">
                <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${practice.progress * 50}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">第一次拍摄 + 带着反馈复拍一次</p>
            </div>
          </div>
        </section>
      )}

      <section className="container-page !pb-10 !pt-2">
        <div className="grid gap-4 md:grid-cols-3">
          <Link className="card group transition hover:-translate-y-1" to="/ai">
            <p className="section-eyebrow">自由创作</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">分析一张其他照片</h2>
            <p className="mt-3 text-sm leading-7 text-muted">需要自由分析、修图参数或示范版本时，继续使用 AI 工作室。</p>
          </Link>
          <Link className="card group transition hover:-translate-y-1" to="/portfolio">
            <p className="section-eyebrow">成长作品</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">整理你的作品集</h2>
            <p className="mt-3 text-sm leading-7 text-muted">保留原图、改进版本和每个阶段值得记住的作品。</p>
          </Link>
          <Link className="card group transition hover:-translate-y-1" to="/community">
            <p className="section-eyebrow">摄影社区</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">看看别人怎么拍</h2>
            <p className="mt-3 text-sm leading-7 text-muted">从真实作品中获得灵感，并和其他摄影爱好者交流。</p>
          </Link>
        </div>
      </section>

      <DailyInspirationSection />
    </main>
  );
}
