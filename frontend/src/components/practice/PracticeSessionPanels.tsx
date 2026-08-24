import { FormEvent, useState } from "react";
import { getAssetUrl } from "../../api/client";
import PhotoUpload from "../PhotoUpload";
import type { PracticeSession } from "../../types";
import {
  CATEGORY_LABELS,
  DIFFICULTY_CONFIRMATIONS,
  DIFFICULTY_OPTIONS,
  MAX_PRACTICE_ROUNDS,
  type DifficultyValue,
} from "./practiceConstants";
import trophySvg from "../../SVG/奖杯.svg?url";
import PracticeGoalSparkleLoader from "./PracticeGoalSparkleLoader";

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
    <form className="practice-task-brief__panel mt-6 scroll-mt-28" onSubmit={submit}>
      <p className="section-eyebrow">提交这一轮</p>
      <h3 className="mt-2 font-display text-2xl font-semibold">选 1—3 张照片</h3>
      <p className="mt-2 text-sm text-muted">反馈只围绕当前练习目标。</p>
      <div className="practice-submission-photos mt-6">
        {images.map((image, index) => (
          <PhotoUpload
            key={index}
            value={image}
            onChange={(value) => setImages((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
            label={index === 0 ? "上传练习照片" : `上传第 ${index + 1} 张`}
            purpose="practice"
            gridCell
          />
        ))}
      </div>
      {images.length < 3 && (
        <button type="button" className="btn-ghost mt-3" onClick={() => setImages((current) => [...current, null])}>＋ 再加一张</button>
      )}
      <label className="mt-6 block max-w-2xl">
        <span className="label">可选：这次做了什么调整？</span>
        <input
          className="input ink-focus-frame"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          maxLength={600}
          placeholder="例如：我让人物离背景更远了"
        />
      </label>
      <button className="btn-primary btn-primary--ink mt-5" type="submit" disabled={loading || !images.some(Boolean)}>
        {loading ? loadingText : "提交这一轮"}
      </button>
    </form>
  );
}

export function TaskBrief({ session, titleIcon, onStart, onReplace, onSubmit, onClose, working, workingText }: {
  session: PracticeSession;
  titleIcon?: string;
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
    <section className="practice-task-brief">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted">任务详情 · [{CATEGORY_LABELS[session.category]}] · [{session.skill_focus}]</p>
          <h2 className="practice-plan-item__title mt-3 font-display text-3xl font-semibold sm:text-4xl">
            <span>{session.title}</span>
            {titleIcon && (
              <img src={titleIcon} alt="" aria-hidden="true" draggable={false} className="practice-task-brief__title-icon" />
            )}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{session.brief}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>返回列表</button>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="practice-task-brief__panel practice-task-brief__goal-panel">
          <p className="text-xs text-muted">目标</p>
          <h3 className="mt-3 font-display text-2xl font-semibold leading-tight">{session.coach_note}</h3>
          {session.source_image_url ? (
            <img className="mt-5 aspect-[4/3] w-full rounded-2xl object-cover" src={getAssetUrl(session.source_image_url)} alt="目标原图" />
          ) : (
            <div className="practice-task-brief__goal-loader">
              <PracticeGoalSparkleLoader />
            </div>
          )}
        </div>
        <div>
          <p className="section-eyebrow">拍摄建议</p>
          <ol className="mt-5 space-y-4">
            {session.steps.slice(0, 3).map((step, index) => (
              <li key={step} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sand bg-white/60 text-xs font-medium text-ink">{index + 1}</span>
                <span className="pt-1 text-sm leading-6">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            {session.success_criteria.map((item) => (
              <span key={item} className="practice-tag practice-tag--achieved rounded-full px-3 py-2 text-xs">✓ {item}</span>
            ))}
          </div>
        </div>
      </div>

      {!showSubmission && (
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-primary btn-primary--ink" disabled={working} onClick={() => void begin()}>开始练习</button>
          <button type="button" className="btn-ghost" onClick={onReplace}>换个重点</button>
        </div>
      )}
      {showSubmission && <SubmissionForm onSubmit={onSubmit} loading={working} loadingText={workingText} />}
    </section>
  );
}

export function FeedbackView({ session, onRate, onComplete, onSubmit, onClose, working, workingText }: {
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
    <section className="practice-feedback scroll-mt-24" id="practice-detail">
      <div className="animate-fade-up">
        <div className="practice-feedback-header">
          <div className="practice-feedback-header__lead">
            <p className="section-eyebrow">{session.title} · 第 {roundCount} 轮</p>
            <h2 className="mt-2 font-display text-4xl font-semibold">达成 {attempt.achieved_count}/{attempt.criteria_total}</h2>
            <div className="practice-feedback-criteria">
              {attempt.criterion_results.map((item) => (
                <span
                  key={item.criterion}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    item.achieved ? "practice-tag practice-tag--achieved" : "practice-tag practice-tag--pending"
                  }`}
                >
                  {item.achieved ? "✓" : "○"} {item.criterion}
                </span>
              ))}
            </div>
          </div>
          <img
            src={trophySvg}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="practice-feedback-trophy"
          />
          <button type="button" className="practice-feedback-header__back btn-ghost" onClick={onClose}>返回列表</button>
        </div>
        <div className="practice-feedback-insights mt-7">
          <div className="practice-task-brief__panel practice-feedback-insight">
            <p className="text-xs text-muted">做到了</p>
            <p className="mt-2 text-sm leading-7">{attempt.strength}</p>
          </div>
          <div className="practice-task-brief__panel practice-feedback-insight">
            <p className="text-xs text-muted">再试一点</p>
            <p className="mt-2 text-sm leading-7">{attempt.key_issue}</p>
          </div>
          <div className="practice-task-brief__panel practice-feedback-insight">
            <p className="text-xs text-muted">下一步</p>
            <p className="mt-2 text-sm leading-7">{attempt.action_step}</p>
          </div>
        </div>
        {attempt.comparison_summary && <p className="mt-5 text-sm leading-7 text-muted">{attempt.comparison_summary}</p>}
      </div>

      {(comparisonImage || currentImage) && (
        <div className={`practice-feedback-photos mt-5 ${comparisonImage && currentImage ? "practice-feedback-photos--compare" : ""}`}>
          {comparisonImage && (
            <figure className="practice-feedback-photo-card">
              <img src={getAssetUrl(comparisonImage)} alt={comparisonLabel} />
              <figcaption>{comparisonLabel}</figcaption>
            </figure>
          )}
          {currentImage && (
            <figure className="practice-feedback-photo-card">
              <img src={getAssetUrl(currentImage)} alt={`第 ${roundCount} 轮`} />
              <figcaption>第 {roundCount} 轮</figcaption>
            </figure>
          )}
        </div>
      )}

      <div className="mt-5 sm:flex sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-semibold">已练 {roundCount}/{MAX_PRACTICE_ROUNDS} 轮</h3>
          <p className="mt-2 text-sm text-muted">复练轮数不会影响进度条；确认完成后才会达到 100%。</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 sm:ml-6 sm:mt-0">
          {!completed && canRetry && <button type="button" className="btn-primary btn-primary--ink" disabled={working} onClick={() => setRetrying(true)}>再练一轮</button>}
          {!completed && <button type="button" className={canRetry ? "btn-secondary" : "btn-primary btn-primary--ink"} disabled={working} onClick={() => void onComplete()}>完成这个练习</button>}
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
        <div className="mt-5 rounded-3xl border border-ink/20 bg-sand/40 p-6">
          <p className="section-eyebrow">10 分钟简化版</p>
          <h3 className="mt-2 font-display text-2xl font-semibold">{session.simplified_task.title}</h3>
          <ol className="mt-4 space-y-2 text-sm text-muted">{session.simplified_task.steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol>
        </div>
      )}
    </section>
  );
}
