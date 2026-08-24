import StudioProgressBar from "../studio/StudioProgressBar";
import checkCircleSvg from "../../SVG/check-circle.svg?url";
import { CATEGORY_LABELS } from "./practiceConstants";
import type { PracticeSession } from "../../types";

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
      <StudioProgressBar value={session.completion_percent} className="practice-plan-item__bar mt-2" />
      <div className="mt-2 grid grid-cols-3 text-[11px] text-muted">
        <span className={started ? "text-ink" : ""}>{started ? "✓ " : ""}开始</span>
        <span className={`text-center ${submitted ? "text-ink" : ""}`}>{submitted ? "✓ " : ""}提交</span>
        <span className={`text-right ${completed ? "text-ink" : ""}`}>{completed ? "✓ " : ""}完成</span>
      </div>
    </div>
  );
}

type PracticePlanCardProps = {
  index: number;
  session: PracticeSession;
  titleIcon?: string;
  onOpen: () => void;
  onReplace: () => void;
};

export default function PracticePlanCard({ index, session, titleIcon, onOpen, onReplace }: PracticePlanCardProps) {
  const completed = session.status === "completed";
  const actionLabel = completed ? "查看结果" : session.progress_stage === "not_started" ? "开始练习" : "继续练习";
  return (
    <article className="practice-plan-item border-t border-sand pt-8 mt-10 first:mt-0 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4 sm:gap-5">
        <span className="practice-plan-item__index font-display text-3xl font-semibold leading-none text-ink/35 sm:text-4xl" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-3 py-1 ${session.plan_role === "primary" ? "bg-ink text-white" : "bg-sand/80 text-muted"}`}>
                  {session.plan_role === "primary" ? "主练" : "选练"}
                </span>
                {session.is_carryover && <span className="rounded-full bg-sand/70 px-3 py-1 text-ink">上周延续</span>}
                {completed && (
                  <span className="practice-plan-item__completed inline-flex items-center gap-1 text-ink">
                    已完成
                    <img src={checkCircleSvg} alt="" aria-hidden="true" draggable={false} className="practice-plan-item__completed-icon" />
                  </span>
                )}
              </div>
              <h2 className="practice-plan-item__title mt-3 font-display text-2xl font-semibold sm:text-3xl">
                <span>{session.title}</span>
                {titleIcon && (
                  <img src={titleIcon} alt="" aria-hidden="true" draggable={false} className="practice-plan-item__title-icon" />
                )}
              </h2>
              <p className="mt-2 text-xs text-muted">{CATEGORY_LABELS[session.category]} · {session.skill_focus} · 第 {session.cycle_week}/4 周 · L{session.level}</p>
            </div>
            <span className="text-xs text-muted">约 {session.time_minutes} 分钟</span>
          </div>
          {!completed && <p className="mt-4 text-sm leading-6 text-muted">{session.recommendation_basis}</p>}
          <PracticeProgressBar session={session} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className={completed ? "btn-secondary" : "btn-primary btn-primary--ink"} onClick={onOpen}>{actionLabel}</button>
            {!completed && session.progress_stage === "not_started" && (
              <button type="button" className="btn-ghost" onClick={onReplace}>换个重点</button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
