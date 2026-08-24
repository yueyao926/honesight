import { useEffect, useId, useState } from "react";
import type { PracticeAttempt, PracticeSession } from "../../types";
import { getWeeklyTaskCompletion } from "../../utils/practiceCompletion";
import stampSvg from "../../SVG/印章.svg?url";

type PracticeCompletionStandardsProps = {
  session: PracticeSession;
  attempt?: PracticeAttempt | null;
  className?: string;
  optionalChallenge?: string;
};

function HandDrawnNoiseFilter({ filterId }: { filterId: string }) {
  return (
    <svg className="practice-completion-filter-defs" aria-hidden="true" width="0" height="0">
      <filter id={filterId}>
        <feTurbulence result="noise" numOctaves={8} baseFrequency="0.1" type="fractalNoise" />
        <feDisplacementMap
          yChannelSelector="G"
          xChannelSelector="R"
          scale={3}
          in2="noise"
          in="SourceGraphic"
        />
      </filter>
    </svg>
  );
}

function CompletionCriterionNote({
  text,
  checked,
  onChange,
  noiseFilterId,
}: {
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  noiseFilterId: string;
}) {
  const filterRef = `url(#${noiseFilterId})`;

  return (
    <label className="notebook-checkbox practice-completion-checkbox" style={{ filter: filterRef }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="checkmark" style={{ filter: filterRef }} />
      <span className="text" style={{ filter: filterRef }}>
        <span className="text-content">{text}</span>
        <svg preserveAspectRatio="none" viewBox="0 0 400 20" className="cut-line" aria-hidden="true">
          <path d="M0,10 H400" />
        </svg>
      </span>
    </label>
  );
}

function WeekStamp({ week, animate }: { week: number; animate: boolean }) {
  const label = `WEEK ${String(week).padStart(2, "0")}`;

  return (
    <div
      className={`practice-completion-stamp ${animate ? "is-animating" : "is-settled"}`.trim()}
      role="img"
      aria-label={`${label} 本周印章`}
    >
      <img src={stampSvg} alt="" aria-hidden="true" draggable={false} className="practice-completion-stamp-image" />
    </div>
  );
}

export default function PracticeCompletionStandards({
  session,
  attempt = null,
  className = "",
  optionalChallenge,
}: PracticeCompletionStandardsProps) {
  const noiseFilterId = `practice-hand-drawn-noise-${useId().replace(/:/g, "")}`;
  const weeklyTask = getWeeklyTaskCompletion(session, attempt);
  const { completionCriteria } = weeklyTask;
  const criteriaKey = completionCriteria.map((item) => item.text).join("|");
  const [checkedItems, setCheckedItems] = useState<boolean[]>(() => completionCriteria.map((item) => item.passed));

  useEffect(() => {
    setCheckedItems(completionCriteria.map((item) => item.passed));
  }, [session.id, attempt?.id, criteriaKey]);

  const passedCount = checkedItems.filter(Boolean).length;
  const total = completionCriteria.length;
  const allPassed = total > 0 && passedCount === total;
  const stampStorageKey = `practice-stamp-${session.id}-${attempt?.id ?? "task"}-${criteriaKey}`;
  const [stampState, setStampState] = useState<"hidden" | "animate" | "settled">("hidden");

  useEffect(() => {
    if (!allPassed) {
      setStampState("hidden");
      return;
    }
    if (sessionStorage.getItem(stampStorageKey)) {
      setStampState("settled");
      return;
    }
    sessionStorage.setItem(stampStorageKey, "1");
    setStampState("animate");
  }, [allPassed, stampStorageKey]);

  if (!completionCriteria.length) return null;

  function toggleCriterion(index: number, nextChecked: boolean) {
    setCheckedItems((current) => current.map((value, itemIndex) => (itemIndex === index ? nextChecked : value)));
  }

  return (
    <section className={`practice-completion-standards ${className}`.trim()}>
      <HandDrawnNoiseFilter filterId={noiseFilterId} />
      <p className="practice-completion-eyebrow">完成标准</p>
      <div className="practice-completion-body">
        <div className="practice-completion-notes">
          {completionCriteria.map((item, index) => (
            <CompletionCriterionNote
              key={item.text}
              text={item.text}
              checked={Boolean(checkedItems[index])}
              onChange={(nextChecked) => toggleCriterion(index, nextChecked)}
              noiseFilterId={noiseFilterId}
            />
          ))}
        </div>
        <div className="practice-completion-side">
          <div className="practice-completion-status-row">
            <div className="practice-completion-text-col">
              <p className="practice-completion-count">
                完成 {passedCount} / {total}
              </p>
              <p className="practice-completion-unlock">
                {allPassed ? "本周印章已解锁" : "解锁本周印章"}
              </p>
            </div>
            {stampState !== "hidden" ? (
              <WeekStamp week={session.cycle_week} animate={stampState === "animate"} />
            ) : null}
          </div>
        </div>
      </div>
      {optionalChallenge ? (
        <details className="practice-completion-challenge text-sm">
          <summary className="cursor-pointer text-ink">想加点难度？</summary>
          <p className="mt-2 max-w-md text-muted">{optionalChallenge}</p>
        </details>
      ) : null}
    </section>
  );
}
