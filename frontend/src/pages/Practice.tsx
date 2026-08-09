import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getAssetUrl } from "../api/client";
import {
  completePracticeSession,
  getPracticeOverview,
  startPracticeSession,
  submitPracticeAttempt,
  updatePracticeDifficulty,
  type StartPracticePayload,
} from "../api/practice";
import PhotoUpload from "../components/PhotoUpload";
import type { PracticeOverview, PracticeProgress, PracticeSession } from "../types";

const TARGETS = ["构图", "光线", "清晰度", "色彩", "不确定"] as const;
const CATEGORIES = ["人像", "风景", "拍物"] as const;
const MAX_PRACTICE_ROUNDS = 3;
type DifficultyValue = "too_easy" | "just_right" | "too_hard";

const DIFFICULTY_OPTIONS: Array<[DifficultyValue, string]> = [
  ["too_easy", "太简单"],
  ["just_right", "正合适"],
  ["too_hard", "太难"],
];

const DIFFICULTY_CONFIRMATIONS: Record<DifficultyValue, string> = {
  too_easy: "已记录：太简单。连续轻松达成后，后续练习会适当升级。",
  just_right: "已记录：正合适。下周会继续当前节奏。",
  too_hard: "已记录：太难。已为你准备 10 分钟简化版。",
};

function ChoiceButton({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm transition ${
        selected ? "border-brand bg-brand text-white" : "border-sand bg-white/70 text-ink hover:border-brand/60"
      }`}
    >
      {children}
    </button>
  );
}

function PracticeStarter({
  replacing,
  loading,
  onStart,
}: {
  replacing: boolean;
  loading: boolean;
  onStart: (payload: StartPracticePayload) => Promise<void>;
}) {
  const [mode, setMode] = useState<"improve" | "category">("improve");
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [target, setTarget] = useState<(typeof TARGETS)[number]>("不确定");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("人像");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "improve" && !sourceImage) return;
    await onStart({
      entry_mode: mode,
      source_image_url: sourceImage || undefined,
      target_goal: target,
      category: mode === "category" ? category : undefined,
      replace_current: replacing,
    });
  }

  return (
    <section className="animate-fade-up">
      <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] bg-sand/55 p-1.5 sm:w-[28rem]">
        {[
          ["improve", "改进这张"],
          ["category", "分类练习"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${mode === value ? "bg-white text-ink shadow-card" : "text-muted"}`}
            onClick={() => setMode(value as "improve" | "category")}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="card mt-5" onSubmit={submit}>
        {mode === "improve" ? (
          <>
            <p className="section-eyebrow">从一张照片开始</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">上传想改进的照片</h2>
            <p className="mt-2 text-sm text-muted">我们会把问题变成练习。</p>
            <div className="mt-6 max-w-2xl">
              <PhotoUpload value={sourceImage} onChange={setSourceImage} label="选择一张目标照片" />
            </div>
            <fieldset className="mt-7">
              <legend className="text-sm font-medium">这次最想改善什么？</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {TARGETS.map((item) => (
                  <ChoiceButton key={item} selected={target === item} onClick={() => setTarget(item)}>
                    {item === "不确定" ? "不确定，帮我判断" : item}
                  </ChoiceButton>
                ))}
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <p className="section-eyebrow">没有目标照片？</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">选个主题开始</h2>
            <p className="mt-2 text-sm text-muted">会结合你的水平和最近练习推荐任务。</p>
            <fieldset className="mt-7">
              <legend className="sr-only">选择练习类别</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                    className={`rounded-3xl border p-6 text-left transition ${
                      category === item ? "border-brand bg-blush/70 shadow-card" : "border-sand bg-white/55 hover:border-brand/60"
                    }`}
                  >
                    <span className="text-xs text-muted">分类练习</span>
                    <span className="mt-2 block font-display text-3xl font-semibold">{item}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}
        <button className="btn-primary mt-7 min-w-40" type="submit" disabled={loading || (mode === "improve" && !sourceImage)}>
          {loading ? "正在安排…" : replacing ? "换成这个重点" : "生成本周任务"}
        </button>
      </form>
    </section>
  );
}

function CycleProgress({ week }: { week: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`四周周期，第 ${week} 周`}>
      {[1, 2, 3, 4].map((item) => (
        <span key={item} className={`h-2 rounded-full transition ${item <= week ? "w-7 bg-accent" : "w-4 bg-sand"}`} />
      ))}
    </div>
  );
}

function SubmissionForm({ onSubmit, loading }: { onSubmit: (images: string[], reflection: string) => Promise<boolean>; loading: boolean }) {
  const [images, setImages] = useState<Array<string | null>>([null]);
  const [reflection, setReflection] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uploaded = images.filter((item): item is string => Boolean(item));
    if (!uploaded.length) return;
    await onSubmit(uploaded, reflection);
  }

  return (
    <form className="card scroll-mt-28" id="practice-submit" onSubmit={submit}>
      <p className="section-eyebrow">提交本周练习</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">选 1—3 张照片</h2>
      <p className="mt-2 text-sm text-muted">反馈只围绕本周目标。</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {images.map((image, index) => (
          <PhotoUpload
            key={index}
            value={image}
            onChange={(value) => setImages((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
            label={index === 0 ? "上传练习照片" : `上传第 ${index + 1} 张`}
          />
        ))}
      </div>
      {images.length < 3 && (
        <button type="button" className="btn-ghost mt-3" onClick={() => setImages((current) => [...current, null])}>＋ 再加一张</button>
      )}
      <label className="mt-6 block max-w-2xl">
        <span className="label">可选：这次你做了什么调整？</span>
        <input
          className="input"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          maxLength={600}
          placeholder="例如：我让人物离背景更远了"
        />
      </label>
      <button className="btn-primary mt-5" type="submit" disabled={loading || !images.some(Boolean)}>
        {loading ? "正在查看照片…" : "提交练习"}
      </button>
    </form>
  );
}

function TaskView({ session, onChange, onSubmit, submitting }: {
  session: PracticeSession;
  onChange: () => void;
  onSubmit: (images: string[], reflection: string) => Promise<boolean>;
  submitting: boolean;
}) {
  const [started, setStarted] = useState(false);
  const submitRef = useRef<HTMLDivElement>(null);

  function start() {
    setStarted(true);
    window.setTimeout(() => submitRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] bg-ink text-white shadow-soft md:rounded-[2.5rem]">
        <div className="grid md:grid-cols-[1fr_16rem]">
          <div className="p-6 sm:p-9 lg:p-11">
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span>本周练习</span><span>·</span><span>{session.category}</span><span>·</span><span>{session.time_minutes}分钟</span><span>·</span><span>L{session.level}</span>
            </div>
            <h2 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">{session.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">{session.brief}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <CycleProgress week={session.cycle_week} />
              <span className="text-xs text-white/55">第{session.cycle_week}周 · {session.cycle_label}</span>
            </div>
          </div>
          <div className="flex min-h-48 items-end bg-sand/20 p-6 sm:p-8">
            {session.source_image_url ? (
              <img className="h-44 w-full rounded-2xl object-cover ring-1 ring-white/20" src={getAssetUrl(session.source_image_url)} alt="本周目标原图" />
            ) : (
              <p className="font-display text-2xl font-semibold leading-relaxed text-white/70">光会路过，记得按下快门。</p>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4 flex gap-3 rounded-2xl border border-sand bg-white/55 px-5 py-4 text-sm leading-6">
        <span className="shrink-0 font-medium text-ink">推荐依据</span>
        <p className="text-muted">{session.recommendation_basis}</p>
      </div>

      {session.photo_analysis && (
        <details className="mt-4 rounded-2xl border border-sand bg-white/55 px-5 py-4 text-sm">
          <summary className="cursor-pointer font-medium text-ink">为什么推荐这个练习？</summary>
          <div className="mt-4 grid gap-3 text-muted sm:grid-cols-3">
            <p><span className="block text-xs">照片类型</span><strong className="mt-1 block font-medium text-ink">{session.photo_analysis.photo_type}</strong></p>
            <p><span className="block text-xs">最优先问题</span><strong className="mt-1 block font-medium text-ink">{session.photo_analysis.priority_issue}</strong></p>
            <p><span className="block text-xs">判断可信度</span><strong className="mt-1 block font-medium text-ink">{Math.round(session.photo_analysis.confidence * 100)}%</strong></p>
          </div>
        </details>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="card-soft">
          <p className="section-eyebrow">目标</p>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{session.coach_note}</h3>
          <p className="mt-3 text-sm leading-7 text-muted">本周重点：{session.skill_focus}</p>
        </div>
        <div className="card">
          <p className="section-eyebrow">拍摄建议</p>
          <ol className="mt-5 space-y-4">
            {session.steps.slice(0, 3).map((step, index) => (
              <li key={step} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush text-xs font-medium text-brand-deep">{index + 1}</span>
                <span className="pt-1 text-sm leading-6">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-sand bg-white/55 p-5 sm:flex sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs text-muted">完成标准</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {session.success_criteria.map((item) => <span key={item} className="rounded-full bg-sage/35 px-4 py-2 text-sm">✓ {item}</span>)}
          </div>
        </div>
        <details className="mt-4 text-sm sm:mt-0 sm:text-right">
          <summary className="cursor-pointer text-brand-deep">想加点难度？</summary>
          <p className="mt-2 max-w-md text-muted">{session.optional_challenge}</p>
        </details>
      </section>

      {!started && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary min-w-40" onClick={start}>开始练习</button>
          <button type="button" className="btn-ghost" onClick={onChange}>换个重点</button>
        </div>
      )}
      <div ref={submitRef} className="mt-7">{started && <SubmissionForm onSubmit={onSubmit} loading={submitting} />}</div>
    </>
  );
}

function FeedbackView({ session, onRate, onComplete, onSubmit, working }: {
  session: PracticeSession;
  onRate: (value: DifficultyValue) => Promise<void>;
  onComplete: () => Promise<void>;
  onSubmit: (images: string[], reflection: string) => Promise<boolean>;
  working: boolean;
}) {
  const attempt = session.attempts[session.attempts.length - 1];
  const [pendingRating, setPendingRating] = useState<DifficultyValue | null>(null);
  const [retrying, setRetrying] = useState(false);
  if (!attempt) return null;
  const savedRating = [...session.attempts].reverse().find((item) => item.difficulty_feedback)?.difficulty_feedback || null;
  const rated = Boolean(savedRating);
  const selectedRating = savedRating || pendingRating;
  const roundCount = session.attempts.length;
  const canRetry = roundCount < MAX_PRACTICE_ROUNDS;
  const completed = session.status === "completed";
  const previousAttempt = roundCount > 1 ? session.attempts[roundCount - 2] : null;
  const comparisonImage = previousAttempt?.image_urls[0] || session.source_image_url;
  const comparisonLabel = previousAttempt ? "上一轮" : "练习前";

  async function chooseRating(value: DifficultyValue) {
    setPendingRating(value);
    await onRate(value);
    setPendingRating(null);
  }

  async function submitAnotherRound(images: string[], reflection: string) {
    const saved = await onSubmit(images, reflection);
    if (saved) setRetrying(false);
    return saved;
  }

  return (
    <>
      <section className="card animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">第 {roundCount} 轮 · 本周目标</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">达成 {attempt.achieved_count}/{attempt.criteria_total}</h2>
          </div>
          <span className="rounded-full bg-sage/40 px-4 py-2 text-sm">{session.category} · {session.skill_focus}</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {attempt.criterion_results.map((item) => (
            <span key={item.criterion} className={`rounded-full px-4 py-2 text-sm ${item.achieved ? "bg-sage/35" : "bg-sand/70 text-muted"}`}>
              {item.achieved ? "✓" : "○"} {item.criterion}
            </span>
          ))}
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-sage/30 p-5"><p className="text-xs text-muted">做到了</p><p className="mt-2 text-sm leading-7">{attempt.strength}</p></div>
          <div className="rounded-2xl bg-blush/70 p-5"><p className="text-xs text-muted">再试一点</p><p className="mt-2 text-sm leading-7">{attempt.key_issue}</p></div>
          <div className="rounded-2xl bg-white p-5"><p className="text-xs text-muted">下一步</p><p className="mt-2 text-sm leading-7">{attempt.action_step}</p></div>
        </div>
        {attempt.comparison_summary && <p className="mt-5 rounded-2xl bg-sand/50 px-4 py-3 text-sm text-muted">{attempt.comparison_summary}</p>}
      </section>

      {(comparisonImage || attempt.image_urls.length) && (
        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {comparisonImage && (
            <figure className="overflow-hidden rounded-3xl bg-ink"><img className="aspect-[4/3] w-full object-cover" src={getAssetUrl(comparisonImage)} alt={comparisonLabel} /><figcaption className="px-4 py-3 text-sm text-white">{comparisonLabel}</figcaption></figure>
          )}
          <figure className="overflow-hidden rounded-3xl bg-ink"><img className="aspect-[4/3] w-full object-cover" src={getAssetUrl(attempt.image_urls[0])} alt={`第 ${roundCount} 轮`} /><figcaption className="px-4 py-3 text-sm text-white">第 {roundCount} 轮</figcaption></figure>
        </section>
      )}

      <section className="mt-5 rounded-3xl border border-sand bg-white/60 p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
        <div>
          <h3 className="font-display text-2xl font-semibold">本周已练 {roundCount}/{MAX_PRACTICE_ROUNDS} 轮</h3>
          <p className="mt-2 text-sm text-muted">每一轮都继续练「{session.skill_focus}」。</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 sm:ml-6 sm:mt-0">
          {canRetry && <button type="button" className="btn-primary" disabled={working} onClick={() => setRetrying(true)}>再练一轮</button>}
          {!completed && <button type="button" className={canRetry ? "btn-secondary" : "btn-primary"} disabled={working} onClick={() => void onComplete()}>完成本周</button>}
        </div>
      </section>

      {retrying && <div className="mt-5"><SubmissionForm onSubmit={submitAnotherRound} loading={working} /></div>}

      {completed && <section className="mt-5 rounded-3xl bg-ink p-6 text-white sm:flex sm:items-center sm:justify-between sm:p-8">
        <div>
          <h3 className="font-display text-2xl font-semibold">这周难度怎么样？</h3>
          <p className="mt-2 text-sm text-white/60">我们将根据你的选择调整下一周的练习。</p>
          {selectedRating && (
            <p className="mt-3 text-sm text-white" role="status">
              {pendingRating && working ? "正在记录你的选择…" : DIFFICULTY_CONFIRMATIONS[selectedRating]}
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 sm:ml-6 sm:mt-0">
          {DIFFICULTY_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={working || rated}
              aria-pressed={selectedRating === value}
              onClick={() => void chooseRating(value)}
              className={`rounded-full border px-4 py-2.5 text-sm transition ${selectedRating === value ? "border-white bg-white text-ink opacity-100" : "border-white/25 hover:bg-white/10 disabled:opacity-50"}`}
            >{selectedRating === value ? `✓ ${label}` : label}</button>
          ))}
        </div>
      </section>}

      {session.simplified_task.steps && (
        <section className="mt-5 rounded-3xl border border-brand/25 bg-blush/55 p-6">
          <p className="section-eyebrow">10分钟简化版</p>
          <h3 className="mt-2 font-display text-2xl font-semibold">{session.simplified_task.title}</h3>
          <ol className="mt-4 space-y-2 text-sm text-muted">{session.simplified_task.steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol>
        </section>
      )}
    </>
  );
}

function GrowthSummary({ progress, history }: { progress: PracticeProgress[]; history: PracticeSession[] }) {
  const visibleProgress = progress.slice(0, 4);
  return (
    <section className="mt-12 grid gap-5 lg:grid-cols-2">
      <div>
        <p className="section-eyebrow">当前能力</p>
        <div className="mt-4 space-y-3">
          {visibleProgress.length ? visibleProgress.map((item) => (
            <div key={`${item.category}-${item.ability}`} className="rounded-2xl border border-white/70 bg-white/60 p-4">
              <div className="flex items-center justify-between gap-4"><strong className="text-sm">{item.category} · {item.ability} L{item.level}</strong><span className="text-xs text-muted">第{item.cycle_week}周</span></div>
              <p className="mt-2 text-xs text-muted">距离升级还差 {item.remaining_for_level} 次练习</p>
            </div>
          )) : <p className="rounded-2xl bg-white/50 p-5 text-sm text-muted">完成第一周后，这里会分别记录各类别能力。</p>}
        </div>
      </div>
      <div>
        <p className="section-eyebrow">最近练习</p>
        <div className="mt-4 space-y-3">
          {history.length ? history.slice(0, 4).map((item) => {
            const best = [...item.attempts].sort((a, b) => b.achieved_count - a.achieved_count)[0];
            return (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/60 p-4">
                <div><strong className="text-sm">{item.title}</strong><p className="mt-1 text-xs text-muted">{item.category} · {item.time_minutes}分钟 · L{item.level} · {item.attempts.length}轮</p></div>
                <span className="text-xs text-accent">最佳 {best?.achieved_count || 0}/{best?.criteria_total || 0}</span>
              </div>
            );
          }) : <p className="rounded-2xl bg-white/50 p-5 text-sm text-muted">还没有历史练习，先完成本周任务。</p>}
        </div>
      </div>
    </section>
  );
}

export default function Practice() {
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPracticeOverview()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "无法载入每周练习"))
      .finally(() => setLoading(false));
  }, []);

  async function start(payload: StartPracticePayload) {
    setWorking(true);
    setError("");
    try {
      await startPracticeSession(payload);
      setOverview(await getPracticeOverview());
      setChanging(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务生成失败，请稍后重试");
    } finally {
      setWorking(false);
    }
  }

  async function submit(images: string[], reflection: string): Promise<boolean> {
    setWorking(true);
    setError("");
    try {
      await submitPracticeAttempt({ image_urls: images, self_reflection: reflection });
      setOverview(await getPracticeOverview());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function complete() {
    setWorking(true);
    setError("");
    try {
      await completePracticeSession();
      setOverview(await getPracticeOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成状态保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function rate(value: DifficultyValue) {
    setWorking(true);
    setError("");
    try {
      const updatedSession = await updatePracticeDifficulty(value);
      setOverview((current) => current ? { ...current, current: updatedSession } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "难度反馈保存失败");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <main className="container-page"><div className="card animate-pulse text-sm text-muted">正在准备每周一练…</div></main>;

  const session = overview?.current || null;
  return (
    <main className="container-page max-w-5xl">
      <header className="mb-8 animate-fade-up">
        <p className="section-eyebrow">LensCoach</p>
        <h1 className="page-title mt-2">每周一练</h1>
        <p className="mt-3 text-base text-muted">慢慢拍，也是在慢慢看见。</p>
      </header>

      {(!session || changing) && <PracticeStarter replacing={Boolean(session)} loading={working} onStart={start} />}
      {session && !changing && session.attempts.length === 0 && (
        <TaskView session={session} onChange={() => setChanging(true)} onSubmit={submit} submitting={working} />
      )}
      {session && !changing && session.attempts.length > 0 && (
        <FeedbackView session={session} onRate={rate} onComplete={complete} onSubmit={submit} working={working} />
      )}

      {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <GrowthSummary progress={overview?.progress || []} history={overview?.history || []} />
    </main>
  );
}
