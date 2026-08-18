import { FormEvent, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getAssetUrl } from "../api/client";
import {
  completePracticeSession,
  getPracticeOverview,
  markPracticeStarted,
  startPracticeAttemptJob,
  startPracticeSessionJob,
  updatePracticeDifficulty,
  waitForPracticeAttemptJob,
  waitForPracticeSessionJob,
  type StartPracticePayload,
} from "../api/practice";
import PhotoUpload from "../components/PhotoUpload";
import InteractiveCameraPerson from "../components/practice/InteractiveCameraPerson";
import SquigglyText from "../components/ui/SquigglyText";
import type { PracticeOverview, PracticeSession } from "../types";

type AbilityValue = "构图" | "光线" | "清晰度" | "色彩" | "不确定";
type DifficultyValue = "too_easy" | "just_right" | "too_hard";

const ABILITIES: Array<{ value: AbilityValue; title: string; description: string }> = [
  { value: "不确定", title: "帮我推荐", description: "结合连续训练和最近练习安排" },
  { value: "构图", title: "让主体更突出", description: "练习画面主次与空间安排" },
  { value: "光线", title: "让明暗更舒服", description: "观察并控制光线方向与亮度" },
  { value: "清晰度", title: "把关键位置拍清楚", description: "练习对焦、稳定和细节表现" },
  { value: "色彩", title: "让颜色自然统一", description: "控制主色、肤色和环境杂色" },
];
const CATEGORIES = ["人像", "风景", "拍物"] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  人像: "人物",
  风景: "风景与街景",
  拍物: "物品与食物",
};
const MAX_PRACTICE_ROUNDS = 3;

const DIFFICULTY_OPTIONS: Array<[DifficultyValue, string]> = [
  ["too_easy", "太简单"],
  ["just_right", "正合适"],
  ["too_hard", "太难"],
];

const DIFFICULTY_CONFIRMATIONS: Record<DifficultyValue, string> = {
  too_easy: "已记录：太简单。连续轻松达成后，后续练习会适当升级。",
  just_right: "已记录：正合适。下一次会继续当前节奏。",
  too_hard: "已记录：太难。已为你准备 10 分钟简化版。",
};

function formatWeekLabel(weekKey: string | undefined) {
  const matched = weekKey?.match(/^(\d{4})-W(\d{2})$/);
  return matched ? `${matched[1]} 年 · 第 ${Number(matched[2])} 周` : "LensCoach";
}

function ChoiceButton({ selected, disabled, children, onClick }: {
  selected: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "border-brand bg-brand text-white" : "border-sand bg-white/70 text-ink hover:border-brand/60"
      }`}
    >
      {children}
    </button>
  );
}

function PracticeStarter({
  role,
  sessions,
  replaceSession,
  remainingMinutes,
  loading,
  loadingText,
  onCancel,
  onStart,
}: {
  role: "primary" | "optional";
  sessions: PracticeSession[];
  replaceSession?: PracticeSession | null;
  remainingMinutes: number;
  loading: boolean;
  loadingText: string;
  onCancel?: () => void;
  onStart: (payload: StartPracticePayload) => Promise<void>;
}) {
  const [mode, setMode] = useState<"improve" | "category">(replaceSession?.entry_mode || "category");
  const [sourceImage, setSourceImage] = useState<string | null>(replaceSession?.source_image_url || null);
  const savedTarget = ABILITIES.some((item) => item.value === replaceSession?.target_goal)
    ? replaceSession?.target_goal as AbilityValue
    : "不确定";
  const [target, setTarget] = useState<AbilityValue>(savedTarget);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(replaceSession?.category || "人像");
  const existingAbilities = new Set(
    sessions.filter((item) => item.id !== replaceSession?.id).map((item) => item.skill_focus),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "improve" && !sourceImage) return;
    await onStart({
      entry_mode: mode,
      source_image_url: sourceImage || undefined,
      target_goal: target,
      category: mode === "category" ? category : undefined,
      plan_role: replaceSession?.plan_role || role,
      replace_session_id: replaceSession?.id,
    });
  }

  const recommendationPreview = mode === "improve"
    ? target === "不确定"
      ? "会先分析照片中最需要改善的能力，再结合当前等级、四周训练进度和可用时间安排。"
      : `会优先按你选择的「${target}」，再结合照片中的具体问题和当前等级安排。`
    : target === "不确定"
      ? `会在「${CATEGORY_LABELS[category]}」场景中优先延续未完成的四周训练，否则推荐近期练得较少的能力。`
      : `会按你选择的「${target}」能力，在「${CATEGORY_LABELS[category]}」场景中匹配当前等级和时间。`;

  return (
    <section className="animate-fade-up rounded-[2rem] border border-sand bg-white/55 p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">{replaceSession ? "调整尚未开始的练习" : role === "primary" ? "安排主练" : "添加选练"}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">这次想练出什么变化？</h2>
          <p className="mt-2 text-sm text-muted">
            {remainingMinutes > 0 ? `本周还可安排约 ${remainingMinutes} 分钟。` : "本周时间已排满，仍可按需要添加选练。"}
          </p>
        </div>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-[1.4rem] bg-sand/55 p-1.5 sm:w-[28rem]">
        {([[
          "category", "自主选练",
        ], [
          "improve", "改进这张",
        ]] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${mode === value ? "bg-white text-ink shadow-card" : "text-muted"}`}
            onClick={() => setMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="mt-7" onSubmit={submit}>
        {mode === "improve" && (
          <div className="max-w-2xl">
            <PhotoUpload value={sourceImage} onChange={setSourceImage} label="选择一张想改进的照片" purpose="practice" />
            <p className="mt-3 text-xs text-muted">照片会保留至四周练习结束后 30 天，练习反馈会继续保留。</p>
          </div>
        )}

        <fieldset className={mode === "improve" ? "mt-7" : ""}>
          <legend className="text-sm font-medium">{mode === "improve" ? "这张照片最想改善什么？" : "先选能力，系统再匹配具体任务"}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ABILITIES.map((item) => {
              const alreadyPlanned = item.value !== "不确定" && existingAbilities.has(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={target === item.value}
                  disabled={alreadyPlanned}
                  onClick={() => setTarget(item.value)}
                  className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    target === item.value ? "border-brand bg-blush/70 shadow-card" : "border-sand bg-white/70 hover:border-brand/60"
                  }`}
                >
                  <strong className="block text-sm">{item.title}</strong>
                  <span className="mt-1 block text-xs leading-5 text-muted">{alreadyPlanned ? "已经在本周计划中" : item.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {mode === "category" && (
          <fieldset className="mt-7">
            <legend className="text-sm font-medium">准备拍什么？</legend>
            <p className="mt-1 text-xs text-muted">场景只用于匹配任务，不会替代你选择的训练能力。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <ChoiceButton key={item} selected={category === item} onClick={() => setCategory(item)}>{CATEGORY_LABELS[item]}</ChoiceButton>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-7 rounded-2xl border border-sand bg-sand/35 px-5 py-4 text-sm leading-6">
          <span className="font-medium text-ink">推荐方式</span>
          <p className="mt-1 text-muted">{recommendationPreview}</p>
        </div>

        <button
          className="btn-primary mt-6 min-w-40"
          type="submit"
          disabled={loading || (mode === "improve" && !sourceImage)}
        >
          {loading ? loadingText : replaceSession ? "重新生成这个练习" : role === "primary" ? "生成主练任务" : "添加到本周计划"}
        </button>
      </form>
    </section>
  );
}

function PracticeProgressBar({ session }: { session: PracticeSession }) {
  const labels = {
    not_started: "尚未开始",
    started: "已开始，可以继续提交",
    submitted: `已提交 ${session.attempts.length} 轮，可继续复练或完成`,
    completed: "练习已完成",
  };
  const started = session.completion_percent >= 25;
  const submitted = session.completion_percent >= 70;
  const completed = session.completion_percent === 100;
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-4 text-xs">
        <strong>练习进度 {session.completion_percent}%</strong>
        <span className="text-muted">{labels[session.progress_stage]}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-label={`${session.title}练习进度`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={session.completion_percent}
      >
        <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${session.completion_percent}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 text-[11px] text-muted">
        <span className={started ? "text-ink" : ""}>{started ? "✓ " : ""}开始</span>
        <span className={`text-center ${submitted ? "text-ink" : ""}`}>{submitted ? "✓ " : ""}提交</span>
        <span className={`text-right ${completed ? "text-ink" : ""}`}>{completed ? "✓ " : ""}完成</span>
      </div>
    </div>
  );
}

function PracticePlanCard({ session, selected, onOpen, onReplace }: {
  session: PracticeSession;
  selected: boolean;
  onOpen: () => void;
  onReplace: () => void;
}) {
  const completed = session.status === "completed";
  const actionLabel = completed ? "查看结果" : session.progress_stage === "not_started" ? "开始练习" : "继续练习";
  return (
    <article className={`rounded-[1.7rem] border p-5 transition sm:p-6 ${selected ? "border-brand bg-white shadow-card" : "border-sand bg-white/65"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-3 py-1 ${session.plan_role === "primary" ? "bg-brand text-white" : "bg-sand/80 text-muted"}`}>
              {session.plan_role === "primary" ? "主练" : "选练"}
            </span>
            {session.is_carryover && <span className="rounded-full bg-blush px-3 py-1 text-brand-deep">上周延续</span>}
            {completed && <span className="rounded-full bg-sage/45 px-3 py-1">已完成</span>}
          </div>
          <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{session.title}</h2>
          <p className="mt-2 text-xs text-muted">{CATEGORY_LABELS[session.category]} · {session.skill_focus} · 第 {session.cycle_week}/4 周 · L{session.level}</p>
        </div>
        <span className="text-xs text-muted">约 {session.time_minutes} 分钟</span>
      </div>
      {!completed && <p className="mt-4 text-sm leading-6 text-muted">{session.recommendation_basis}</p>}
      <PracticeProgressBar session={session} />
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className={completed ? "btn-secondary" : "btn-primary"} onClick={onOpen}>{actionLabel}</button>
        {!completed && session.progress_stage === "not_started" && (
          <button type="button" className="btn-ghost" onClick={onReplace}>换个重点</button>
        )}
      </div>
    </article>
  );
}

function SubmissionForm({ onSubmit, loading, loadingText }: {
  onSubmit: (images: string[], reflection: string) => Promise<boolean>;
  loading: boolean;
  loadingText: string;
}) {
  const [images, setImages] = useState<Array<string | null>>([null]);
  const [reflection, setReflection] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uploaded = images.filter((item): item is string => Boolean(item));
    if (!uploaded.length) return;
    await onSubmit(uploaded, reflection);
  }

  return (
    <form className="mt-6 rounded-3xl border border-sand bg-white/70 p-5 scroll-mt-28 sm:p-7" onSubmit={submit}>
      <p className="section-eyebrow">提交这一轮</p>
      <h3 className="mt-2 font-display text-2xl font-semibold">选 1—3 张照片</h3>
      <p className="mt-2 text-sm text-muted">反馈只围绕当前练习目标。</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {images.map((image, index) => (
          <PhotoUpload
            key={index}
            value={image}
            onChange={(value) => setImages((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
            label={index === 0 ? "上传练习照片" : `上传第 ${index + 1} 张`}
            purpose="practice"
          />
        ))}
      </div>
      {images.length < 3 && (
        <button type="button" className="btn-ghost mt-3" onClick={() => setImages((current) => [...current, null])}>＋ 再加一张</button>
      )}
      <label className="mt-6 block max-w-2xl">
        <span className="label">可选：这次做了什么调整？</span>
        <input
          className="input"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          maxLength={600}
          placeholder="例如：我让人物离背景更远了"
        />
      </label>
      <button className="btn-primary mt-5" type="submit" disabled={loading || !images.some(Boolean)}>
        {loading ? loadingText : "提交这一轮"}
      </button>
    </form>
  );
}

function TaskBrief({ session, onStart, onReplace, onSubmit, onClose, working, workingText }: {
  session: PracticeSession;
  onStart: () => Promise<boolean>;
  onReplace: () => void;
  onSubmit: (images: string[], reflection: string) => Promise<boolean>;
  onClose: () => void;
  working: boolean;
  workingText: string;
}) {
  const [showSubmission, setShowSubmission] = useState(session.progress_stage === "started");

  async function begin() {
    if (await onStart()) setShowSubmission(true);
  }

  return (
    <section className="mt-6 rounded-[2rem] bg-ink p-6 text-white shadow-soft sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-white/55">任务详情 · {CATEGORY_LABELS[session.category]} · {session.skill_focus}</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{session.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">{session.brief}</p>
        </div>
        <button type="button" className="rounded-full border border-white/25 px-4 py-2 text-sm" onClick={onClose}>收起</button>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-3xl bg-white/10 p-5">
          <p className="text-xs text-white/50">目标</p>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{session.coach_note}</h3>
          {session.source_image_url && <img className="mt-5 aspect-[4/3] w-full rounded-2xl object-cover" src={getAssetUrl(session.source_image_url)} alt="目标原图" />}
        </div>
        <div className="rounded-3xl bg-white p-5 text-ink sm:p-6">
          <p className="section-eyebrow">拍摄建议</p>
          <ol className="mt-5 space-y-4">
            {session.steps.slice(0, 3).map((step, index) => (
              <li key={step} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blush text-xs font-medium text-brand-deep">{index + 1}</span>
                <span className="pt-1 text-sm leading-6">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            {session.success_criteria.map((item) => <span key={item} className="rounded-full bg-sage/35 px-3 py-2 text-xs">✓ {item}</span>)}
          </div>
        </div>
      </div>

      {!showSubmission && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary" disabled={working} onClick={() => void begin()}>开始练习</button>
          <button type="button" className="rounded-full border border-white/25 px-5 py-3 text-sm" onClick={onReplace}>换个重点</button>
        </div>
      )}
      {showSubmission && <SubmissionForm onSubmit={onSubmit} loading={working} loadingText={workingText} />}
    </section>
  );
}

function FeedbackView({ session, onRate, onComplete, onSubmit, onClose, working, workingText }: {
  session: PracticeSession;
  onRate: (value: DifficultyValue) => Promise<void>;
  onComplete: () => Promise<void>;
  onSubmit: (images: string[], reflection: string) => Promise<boolean>;
  onClose: () => void;
  working: boolean;
  workingText: string;
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
  const currentImage = attempt.image_urls[0];

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
    <section className="mt-6 scroll-mt-24" id="practice-detail">
      <div className="card animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">{session.title} · 第 {roundCount} 轮</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">达成 {attempt.achieved_count}/{attempt.criteria_total}</h2>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>收起</button>
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
      </div>

      {(comparisonImage || currentImage) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {comparisonImage && <figure className="overflow-hidden rounded-3xl bg-ink"><img className="aspect-[4/3] w-full object-cover" src={getAssetUrl(comparisonImage)} alt={comparisonLabel} /><figcaption className="px-4 py-3 text-sm text-white">{comparisonLabel}</figcaption></figure>}
          {currentImage && <figure className="overflow-hidden rounded-3xl bg-ink"><img className="aspect-[4/3] w-full object-cover" src={getAssetUrl(currentImage)} alt={`第 ${roundCount} 轮`} /><figcaption className="px-4 py-3 text-sm text-white">第 {roundCount} 轮</figcaption></figure>}
        </div>
      )}

      <div className="mt-5 rounded-3xl border border-sand bg-white/60 p-6 sm:flex sm:items-center sm:justify-between sm:p-8">
        <div>
          <h3 className="font-display text-2xl font-semibold">已练 {roundCount}/{MAX_PRACTICE_ROUNDS} 轮</h3>
          <p className="mt-2 text-sm text-muted">复练轮数不会影响进度条；确认完成后才会达到 100%。</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 sm:ml-6 sm:mt-0">
          {!completed && canRetry && <button type="button" className="btn-primary" disabled={working} onClick={() => setRetrying(true)}>再练一轮</button>}
          {!completed && <button type="button" className={canRetry ? "btn-secondary" : "btn-primary"} disabled={working} onClick={() => void onComplete()}>完成这个练习</button>}
        </div>
      </div>

      {retrying && <SubmissionForm onSubmit={submitAnotherRound} loading={working} loadingText={workingText} />}

      {completed && <div className="mt-5 rounded-3xl bg-ink p-6 text-white sm:flex sm:items-center sm:justify-between sm:p-8">
        <div>
          <h3 className="font-display text-2xl font-semibold">这项练习难度怎么样？</h3>
          <p className="mt-2 text-sm text-white/60">你的选择会调整这项能力下一次的难度。</p>
          {selectedRating && <p className="mt-3 text-sm text-white" role="status">{pendingRating && working ? "正在记录你的选择…" : DIFFICULTY_CONFIRMATIONS[selectedRating]}</p>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 sm:ml-6 sm:mt-0">
          {DIFFICULTY_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={working || rated}
              aria-pressed={selectedRating === value}
              onClick={() => void chooseRating(value)}
              className={`rounded-full border px-4 py-2.5 text-sm transition ${selectedRating === value ? "border-white bg-white text-ink" : "border-white/25 hover:bg-white/10 disabled:opacity-50"}`}
            >{selectedRating === value ? `✓ ${label}` : label}</button>
          ))}
        </div>
      </div>}

      {session.simplified_task.steps && (
        <div className="mt-5 rounded-3xl border border-brand/25 bg-blush/55 p-6">
          <p className="section-eyebrow">10 分钟简化版</p>
          <h3 className="mt-2 font-display text-2xl font-semibold">{session.simplified_task.title}</h3>
          <ol className="mt-4 space-y-2 text-sm text-muted">{session.simplified_task.steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol>
        </div>
      )}
    </section>
  );
}

export default function Practice() {
  const [overview, setOverview] = useState<PracticeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [workingText, setWorkingText] = useState("正在准备分析…");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [replacingSessionId, setReplacingSessionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const practiceJobControllerRef = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  async function refreshOverview() {
    const next = await getPracticeOverview();
    setOverview(next);
    return next;
  }

  useEffect(() => {
    refreshOverview()
      .catch((err) => setError(err instanceof Error ? err.message : "无法载入每周练习"))
      .finally(() => setLoading(false));
    return () => practiceJobControllerRef.current?.abort();
  }, []);

  async function start(payload: StartPracticePayload) {
    practiceJobControllerRef.current?.abort();
    const controller = new AbortController();
    practiceJobControllerRef.current = controller;
    setWorking(true);
    setWorkingText("正在准备任务…");
    setError("");
    try {
      const job = await startPracticeSessionJob(payload, controller.signal);
      const result = await waitForPracticeSessionJob(job, controller.signal, (current) => {
        const labels: Record<string, string> = {
          preparing: "正在准备任务…",
          queued: "正在等待分析…",
          analyzing: "正在判断最值得练的重点…",
          organizing: "正在匹配具体任务…",
          completed: "练习已加入计划",
        };
        setWorkingText(labels[current.stage] || "正在安排任务…");
      });
      await refreshOverview();
      setAdding(false);
      setReplacingSessionId(null);
      setSelectedSessionId(result.id);
      window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "任务生成失败，请稍后重试");
    } finally {
      if (practiceJobControllerRef.current === controller) {
        practiceJobControllerRef.current = null;
        setWorking(false);
      }
    }
  }

  async function beginSession(sessionId: number): Promise<boolean> {
    setWorking(true);
    setError("");
    try {
      await markPracticeStarted(sessionId);
      await refreshOverview();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存练习进度");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function submit(sessionId: number, images: string[], reflection: string): Promise<boolean> {
    practiceJobControllerRef.current?.abort();
    const controller = new AbortController();
    practiceJobControllerRef.current = controller;
    setWorking(true);
    setWorkingText("正在准备分析…");
    setError("");
    try {
      const job = await startPracticeAttemptJob(sessionId, { image_urls: images, self_reflection: reflection }, controller.signal);
      await waitForPracticeAttemptJob(job, controller.signal, (current) => {
        const labels: Record<string, string> = {
          preparing: "正在准备照片…",
          queued: "正在等待分析…",
          analyzing: "正在查看当前练习重点…",
          organizing: "正在整理本轮反馈…",
          completed: "反馈已生成",
        };
        setWorkingText(labels[current.stage] || "正在生成反馈…");
      });
      await refreshOverview();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      setError(err instanceof Error ? err.message : "提交失败，请稍后重试");
      return false;
    } finally {
      if (practiceJobControllerRef.current === controller) {
        practiceJobControllerRef.current = null;
        setWorking(false);
      }
    }
  }

  async function complete(sessionId: number) {
    setWorking(true);
    setError("");
    try {
      await completePracticeSession(sessionId);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "完成状态保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function rate(sessionId: number, value: DifficultyValue) {
    setWorking(true);
    setError("");
    try {
      await updatePracticeDifficulty(sessionId, value);
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "难度反馈保存失败");
    } finally {
      setWorking(false);
    }
  }

  function openSession(sessionId: number) {
    setAdding(false);
    setReplacingSessionId(null);
    setSelectedSessionId(sessionId);
    window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  if (loading) return <main className="handwriting-page container-page"><div className="card animate-pulse text-sm text-muted">正在准备每周训练计划…</div></main>;

  const sessions = overview?.current_sessions || (overview?.current ? [overview.current] : []);
  const selectedSession = sessions.find((item) => item.id === selectedSessionId) || null;
  const replaceSession = sessions.find((item) => item.id === replacingSessionId) || null;
  const completedCount = sessions.filter((item) => item.status === "completed").length;
  const hasPrimary = sessions.some((item) => item.plan_role === "primary");
  const primaryCompleted = sessions.some((item) => item.plan_role === "primary" && item.status === "completed");
  const addRole: "primary" | "optional" = hasPrimary ? "optional" : "primary";
  const totalPercent = sessions.length ? Math.round(completedCount / sessions.length * 100) : 0;
  const remainingMinutes = Math.max(0, (overview?.weekly_budget_minutes || 20) - (overview?.scheduled_minutes || 0));

  return (
    <main className="handwriting-page container-page max-w-5xl">
      <header className="relative mb-8 animate-fade-up md:pr-[clamp(7.5rem,17vw,11rem)]">
        <div className="min-w-0">
          <p className="section-eyebrow">{formatWeekLabel(overview?.week_key)}</p>
          <h1 className="page-title mt-2">每周一练</h1>
          <p className="mt-2 max-w-[calc(100%-clamp(8rem,18vw,12rem))] text-base">
            <SquigglyText
              as="span"
              stepDuration={70}
              scale={[2, 3.5]}
              baseFrequency={0.018}
              className="text-muted"
            >
              主练完成即可达成本周目标，选练按你的时间自由添加。
            </SquigglyText>
          </p>
        </div>
        <InteractiveCameraPerson className="interactive-camera-person--practice-header absolute hidden shrink-0 md:block" />
      </header>

      {sessions.length > 0 && (
        <section className="mb-6 rounded-3xl border border-sand bg-white/55 p-5 sm:flex sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs text-muted">本周总进度</p>
            <p className="mt-1 font-display text-2xl font-semibold">{primaryCompleted ? "本周目标已达成" : hasPrimary ? "主练进行中" : "等待安排本周主练"}</p>
            <p className="mt-1 text-xs text-muted">已完成 {completedCount}/{sessions.length} 项练习</p>
          </div>
          <div className="mt-4 min-w-56 sm:mt-0 sm:text-right">
            <p className="text-xs text-muted">已安排 {overview?.scheduled_minutes || 0}/{overview?.weekly_budget_minutes || 20} 分钟</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-label="本周总进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={totalPercent}>
              <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${totalPercent}%` }} />
            </div>
          </div>
        </section>
      )}

      {sessions.length === 0 && !adding && (
        <PracticeStarter role="primary" sessions={sessions} remainingMinutes={remainingMinutes} loading={working} loadingText={workingText} onStart={start} />
      )}

      {sessions.length > 0 && (
        <section className="space-y-4" aria-label="本周练习">
          {sessions.map((session) => (
            <PracticePlanCard
              key={session.id}
              session={session}
              selected={selectedSessionId === session.id}
              onOpen={() => openSession(session.id)}
              onReplace={() => {
                setSelectedSessionId(null);
                setAdding(false);
                setReplacingSessionId(session.id);
              }}
            />
          ))}
        </section>
      )}

      <div ref={detailRef} className="scroll-mt-24">
        {selectedSession && selectedSession.attempts.length === 0 && (
          <TaskBrief
            key={selectedSession.id}
            session={selectedSession}
            onStart={() => beginSession(selectedSession.id)}
            onReplace={() => {
              setSelectedSessionId(null);
              setReplacingSessionId(selectedSession.id);
            }}
            onSubmit={(images, reflection) => submit(selectedSession.id, images, reflection)}
            onClose={() => setSelectedSessionId(null)}
            working={working}
            workingText={workingText}
          />
        )}
        {selectedSession && selectedSession.attempts.length > 0 && (
          <FeedbackView
            key={selectedSession.id}
            session={selectedSession}
            onRate={(value) => rate(selectedSession.id, value)}
            onComplete={() => complete(selectedSession.id)}
            onSubmit={(images, reflection) => submit(selectedSession.id, images, reflection)}
            onClose={() => setSelectedSessionId(null)}
            working={working}
            workingText={workingText}
          />
        )}
      </div>

      {replaceSession && (
        <div className="mt-6">
          <PracticeStarter
            role={replaceSession.plan_role}
            sessions={sessions}
            replaceSession={replaceSession}
            remainingMinutes={remainingMinutes}
            loading={working}
            loadingText={workingText}
            onCancel={() => setReplacingSessionId(null)}
            onStart={start}
          />
        </div>
      )}

      {sessions.length > 0 && !replaceSession && !adding && overview?.can_add && (
        <button
          type="button"
          className="mt-6 flex w-full items-center justify-between rounded-3xl border border-dashed border-sand bg-white/35 px-5 py-5 text-left transition hover:border-brand/60 hover:bg-white/55"
          onClick={() => {
            setSelectedSessionId(null);
            setAdding(true);
          }}
        >
          <span><strong className="text-sm">{addRole === "primary" ? "安排本周主练" : "添加一个选练"}</strong><span className="mt-1 block text-xs text-muted">本周最多安排三个不同能力</span></span>
          <span className="text-2xl text-brand-deep">＋</span>
        </button>
      )}

      {sessions.length > 0 && adding && (
        <div className="mt-6">
          <PracticeStarter
            role={addRole}
            sessions={sessions}
            remainingMinutes={remainingMinutes}
            loading={working}
            loadingText={workingText}
            onCancel={() => setAdding(false)}
            onStart={start}
          />
        </div>
      )}

      {sessions.length > 0 && <p className="mt-5 text-center text-xs text-muted">未完成的练习会一直保留；下次进入可以从当前进度继续。</p>}
      {error && <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
