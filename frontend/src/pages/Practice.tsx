import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "../api/client";
import { getCurrentPractice, submitPracticeAttempt } from "../api/practice";
import PhotoUpload from "../components/PhotoUpload";
import type { PracticeAttempt, PracticeSession } from "../types";


function FeedbackCard({ attempt, title }: { attempt: PracticeAttempt; title: string }) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">AI 教练反馈</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">{title}</h2>
        </div>
        <span className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">本次表现 {attempt.skill_score}</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-sage/45 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-deep">已经做好的地方</p>
          <p className="mt-2 text-sm leading-7 text-ink">{attempt.strength}</p>
        </div>
        <div className="rounded-2xl bg-blush/55 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-deep">这次只改一个问题</p>
          <p className="mt-2 text-sm leading-7 text-ink">{attempt.key_issue}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-5 md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-deep">下一次按这个动作拍</p>
          <p className="mt-2 font-display text-xl font-semibold leading-8 text-ink">{attempt.action_step}</p>
        </div>
      </div>
    </section>
  );
}

function SubmissionForm({
  stage,
  loading,
  onSubmit,
}: {
  stage: "first" | "reshoot";
  loading: boolean;
  onSubmit: (imageUrl: string, reflection: string) => Promise<boolean>;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageUrl || !reflection.trim()) return;
    const succeeded = await onSubmit(imageUrl, reflection.trim());
    if (succeeded) {
      setImageUrl(null);
      setReflection("");
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <p className="section-eyebrow">{stage === "first" ? "第一次尝试" : "带着反馈再拍一次"}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold">
        {stage === "first" ? "上传这次练习的代表照片" : "上传你的复拍结果"}
      </h2>
      <p className="mt-2 text-sm leading-7 text-muted">
        {stage === "first"
          ? "先由你判断照片，再让 AI 给反馈。主动观察本身就是练习的一部分。"
          : "尽量保持同一主题，只执行教练给出的那个动作，前后差异会更清楚。"}
      </p>
      <div className="mt-6">
        <PhotoUpload
          value={imageUrl}
          onChange={setImageUrl}
          label={stage === "first" ? "上传第一次拍摄" : "上传复拍照片"}
        />
      </div>
      <label className="mt-6 block">
        <span className="label">你先说说：这张照片哪里做得好，哪里还不满意？</span>
        <textarea
          className="input min-h-32 resize-y"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          maxLength={1200}
          placeholder="例如：主体已经比较明确，但人物头部后面有一根路灯，我觉得背景还是有些乱。"
        />
      </label>
      <button className="btn-primary mt-5" type="submit" disabled={loading || !imageUrl || !reflection.trim()}>
        {loading ? "教练正在查看照片…" : stage === "first" ? "提交并获得反馈" : "提交复拍并查看对比"}
      </button>
    </form>
  );
}

export default function Practice() {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentPractice()
      .then(setSession)
      .catch((err) => setError(err instanceof Error ? err.message : "无法载入本周练习"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(imageUrl: string, reflection: string) {
    setSubmitting(true);
    setError("");
    try {
      setSession(await submitPracticeAttempt({ image_url: imageUrl, self_reflection: reflection }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="container-page"><div className="card animate-pulse text-sm text-muted">正在准备本周练习…</div></main>;
  }
  if (!session) {
    return <main className="container-page"><div className="card text-sm text-red-500">{error || "练习暂不可用"}</div></main>;
  }

  const first = session.attempts.find((attempt) => attempt.stage === "first");
  const reshoot = session.attempts.find((attempt) => attempt.stage === "reshoot");

  return (
    <main className="container-page max-w-5xl">
      <header className="animate-fade-up">
        <Link className="text-sm text-brand-deep" to="/dashboard">← 返回首页</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <p className="section-eyebrow">本周练习 · {session.skill_focus}</p>
            <h1 className="page-title mt-2">{session.title}</h1>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base">{session.brief}</p>
          </div>
          <div className="min-w-40 rounded-2xl bg-white/70 p-4 text-right shadow-card">
            <p className="text-xs text-muted">练习闭环</p>
            <p className="mt-1 font-display text-3xl font-semibold">{session.progress}/2</p>
          </div>
        </div>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card-soft">
          <h2 className="font-display text-xl font-semibold">拍摄限制</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
            {session.constraints.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div className="card-soft">
          <h2 className="font-display text-xl font-semibold">完成标准</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
            {session.success_criteria.map((item) => <li key={item}>✓ {item}</li>)}
          </ul>
        </div>
      </section>

      <div className="mt-6 rounded-2xl bg-ink px-5 py-4 text-sm leading-7 text-white">
        <span className="text-rose">教练提醒：</span>{session.coach_note}
      </div>

      <div className="mt-7 space-y-6">
        {!first && <SubmissionForm stage="first" loading={submitting} onSubmit={handleSubmit} />}

        {first && !reshoot && (
          <>
            <FeedbackCard attempt={first} title="第一次尝试反馈" />
            <div className="rounded-2xl border border-brand/25 bg-white/65 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-brand-deep">复拍任务</p>
              <p className="mt-2 text-sm leading-7 text-ink">{first.reshoot_task}</p>
            </div>
            <SubmissionForm stage="reshoot" loading={submitting} onSubmit={handleSubmit} />
          </>
        )}

        {first && reshoot && (
          <>
            <section className="card">
              <p className="section-eyebrow">本周成长证据</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-display text-3xl font-semibold">第一次与复拍对比</h2>
                <span className={`rounded-full px-4 py-2 text-sm font-medium ${
                  (reshoot.score_change || 0) >= 0 ? "bg-sage/45 text-ink" : "bg-blush/55 text-brand-deep"
                }`}>
                  {reshoot.score_change === null ? "已完成" : `${reshoot.score_change >= 0 ? "+" : ""}${reshoot.score_change} 分`}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-muted">{reshoot.comparison_summary}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  { label: "第一次", attempt: first },
                  { label: "复拍", attempt: reshoot },
                ].map(({ label, attempt: item }: { label: string; attempt: PracticeAttempt }) => {
                  return (
                    <figure key={label} className="overflow-hidden rounded-2xl bg-ink">
                      <img className="aspect-[4/3] w-full object-cover" src={getAssetUrl(item.image_url)} alt={`${label}作品`} />
                      <figcaption className="flex items-center justify-between px-4 py-3 text-sm text-white">
                        <span>{label}</span><span>{item.skill_score} 分</span>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
            <FeedbackCard attempt={reshoot} title="复拍反馈" />
            <div className="rounded-[2rem] bg-ink px-6 py-7 text-white sm:flex sm:items-center sm:justify-between sm:px-9">
              <div>
                <p className="font-display text-2xl font-semibold">你完成了一个完整练习闭环。</p>
                <p className="mt-2 text-sm leading-6 text-white/65">下周会继续根据你的目标安排新的单项练习。</p>
              </div>
              <Link className="mt-5 inline-flex rounded-full bg-white px-6 py-3 text-sm font-medium text-ink sm:mt-0" to="/portfolio">
                去整理成长作品
              </Link>
            </div>
          </>
        )}
      </div>
      {error && <p className="mt-5 text-sm text-red-500">{error}</p>}
    </main>
  );
}
