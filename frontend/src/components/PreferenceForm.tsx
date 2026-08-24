import { FormEvent, useState } from "react";
import type { PreferencePayload } from "../api/preferences";
import type { Preference } from "../types";

const LEVELS = ["刚开始", "有基础", "较熟练", "进阶创作"];
const CATEGORIES = ["人像", "风景", "拍物", "都想练"];
const DEVICES = ["手机", "相机", "都会使用"];
const TIMES = [10, 20, 40];
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const SECTIONS = [
  { question: "你现在的摄影水平更接近？", options: LEVELS },
  { question: "你常拍什么？", options: CATEGORIES },
  { question: "你使用什么设备？", options: DEVICES },
] as const;

function PreferenceRadioSection<T extends string | number>({
  question,
  value,
  options,
  onChange,
  format = (item) => String(item),
}: {
  question: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  format?: (item: T) => string;
}) {
  return (
    <fieldset className="preference-section">
      <legend className="preference-section__header">
        <span className="preference-section__question">{question}</span>
      </legend>
      <ul className="preference-radio-list">
        {options.map((option) => {
          const selected = value === option;
          return (
            <li key={String(option)}>
              <button
                type="button"
                className={`preference-radio-option${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onChange(option)}
              >
                <span className="preference-radio-option__mark" aria-hidden="true">{selected ? "●" : "○"}</span>
                <span>{format(option)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export default function PreferenceForm({
  initial,
  onSubmit,
  submitText,
}: {
  initial?: Partial<Preference> | null;
  onSubmit: (payload: PreferencePayload) => Promise<void>;
  submitText: string;
}) {
  const initialCategory = initial?.photography_categories?.length === 3
    ? "都想练"
    : initial?.photography_categories?.[0] || initial?.common_subjects || "都想练";
  const initialDevice = initial?.shooting_devices?.length === 2
    ? "都会使用"
    : initial?.shooting_devices?.[0] || "手机";
  const [level, setLevel] = useState(initial?.skill_level || "刚开始");
  const [category, setCategory] = useState(initialCategory);
  const [device, setDevice] = useState(initialDevice);
  const [minutes, setMinutes] = useState(initial?.weekly_practice_minutes || 20);
  const [practiceDay, setPracticeDay] = useState(initial?.weekly_practice_day || 1);
  const [reminderEnabled, setReminderEnabled] = useState(initial?.weekly_reminder_enabled ?? true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const categories = category === "都想练" ? ["人像", "风景", "拍物"] : [category];
      const devices = device === "都会使用" ? ["手机", "相机"] : [device];
      await onSubmit({
        skill_level: level,
        common_subjects: category,
        photography_categories: categories,
        shooting_devices: devices,
        weekly_practice_minutes: minutes,
        weekly_practice_day: practiceDay,
        weekly_reminder_enabled: reminderEnabled,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const sectionValues = [level, category, device] as const;
  const sectionSetters = [setLevel, setCategory, setDevice] as const;

  return (
    <form className="preference-form" onSubmit={handleSubmit}>
      <div className="preference-form__grid">
        {SECTIONS.map((section, sectionIndex) => (
          <PreferenceRadioSection
            key={section.question}
            question={section.question}
            value={sectionValues[sectionIndex]}
            options={section.options}
            onChange={sectionSetters[sectionIndex]}
          />
        ))}

        <PreferenceRadioSection
          question="一周想留多少时间给摄影？"
          value={minutes}
          options={TIMES}
          onChange={setMinutes}
          format={(item) => (Number(item) >= 40 ? "40 min +" : `${item} min`)}
        />
      </div>

      {initial && (
        <fieldset className="preference-section preference-reminder">
          <legend className="preference-section__header">
            <span className="preference-section__question">每周提醒</span>
          </legend>
          <p className="preference-section__hint">最多两次，完成后停止。</p>
          <div className="preference-reminder__toggle flex items-center justify-between gap-4">
            <span className="text-sm text-muted">{reminderEnabled ? "已开启" : "已关闭"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={reminderEnabled}
              className={`preference-switch${reminderEnabled ? " preference-switch--on" : ""}`}
              onClick={() => setReminderEnabled((value) => !value)}
            >
              <span className="preference-switch__knob" />
            </button>
          </div>
          {reminderEnabled && (
            <ul className="preference-radio-list preference-radio-list--days">
              {DAYS.map((day, index) => {
                const selected = practiceDay === index + 1;
                return (
                  <li key={day}>
                    <button
                      type="button"
                      className={`preference-radio-option${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => setPracticeDay(index + 1)}
                    >
                      <span className="preference-radio-option__mark" aria-hidden="true">{selected ? "●" : "○"}</span>
                      <span>{day}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      )}

      <button className="btn-primary btn-primary--ink preference-form__submit" type="submit" disabled={submitting}>
        {submitting ? "正在保存…" : submitText}
      </button>
    </form>
  );
}
