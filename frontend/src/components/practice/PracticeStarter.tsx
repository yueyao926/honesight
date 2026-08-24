import { FormEvent, useState, type ReactNode } from "react";
import type { StartPracticePayload } from "../../api/practice";
import PhotoUpload from "../PhotoUpload";
import type { PracticeSession } from "../../types";
import { ABILITIES, CATEGORY_LABELS, CATEGORIES, type AbilityValue } from "./practiceConstants";

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
      className={`preference-option practice-choice-option${selected ? " preference-option--selected" : ""}`}
    >
      {children}
    </button>
  );
}

export default function PracticeStarter({
  role,
  sessions,
  replaceSession,
  remainingMinutes,
  loading,
  loadingText,
  hideIntro = false,
  onCancel,
  onStart,
}: {
  role: "primary" | "optional";
  sessions: PracticeSession[];
  replaceSession?: PracticeSession | null;
  remainingMinutes: number;
  loading: boolean;
  loadingText: string;
  hideIntro?: boolean;
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
    <section className="practice-starter animate-fade-up">
      {!hideIntro && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">{replaceSession ? "调整尚未开始的练习" : role === "primary" ? "安排主练" : "添加选练"}</p>
            <p className="practice-starter-lead mt-2">这次想练出什么变化？</p>
            <p className="mt-1 text-sm text-muted">
              {remainingMinutes > 0 ? `本周还可安排约 ${remainingMinutes} 分钟。` : "本周时间已排满，仍可按需要添加选练。"}
            </p>
          </div>
          {onCancel && (
            <button type="button" className="btn-ghost shrink-0" onClick={onCancel}>
              取消
            </button>
          )}
        </div>
      )}

      <div className={`practice-mode-toggle${hideIntro ? "" : " mt-6"}`}>
        {([
          ["category", "自主选练"],
          ["improve", "改进这张"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            className={`preference-option practice-choice-option${mode === value ? " preference-option--selected" : ""}`}
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
                    target === item.value ? "border-ink" : "border-ink/20 hover:border-ink/60"
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

        <div className="practice-task-brief__panel mt-7 !p-5 text-sm leading-6">
          <span className="font-medium text-ink">推荐方式</span>
          <p className="mt-1 text-muted">{recommendationPreview}</p>
        </div>

        <button
          className="btn-primary btn-primary--ink mt-6 min-w-40"
          type="submit"
          disabled={loading || (mode === "improve" && !sourceImage)}
        >
          {loading ? loadingText : replaceSession ? "重新生成这个练习" : role === "primary" ? "生成主练任务" : "添加到本周计划"}
        </button>
      </form>
    </section>
  );
}
