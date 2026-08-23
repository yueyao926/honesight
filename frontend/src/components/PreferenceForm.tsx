import { FormEvent, useState } from "react";
import type { PreferencePayload } from "../api/preferences";
import type { Preference } from "../types";

const LEVELS = ["刚开始", "有基础", "较熟练", "进阶创作"];
const CATEGORIES = ["人像", "风景", "拍物", "都想练"];
const DEVICES = ["手机", "相机", "都会使用"];
const TIMES = [10, 20, 40];
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function OptionGroup<T extends string | number>({
  value,
  options,
  onChange,
  format = (item) => String(item),
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  format?: (item: T) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            className={`preference-option${selected ? " preference-option--selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onChange(option)}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
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

  return (
    <form className="preference-form space-y-7" onSubmit={handleSubmit}>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">你现在更接近哪种状态？</legend>
        <OptionGroup value={level} options={LEVELS} onChange={setLevel} />
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">你常拍什么？</legend>
        <OptionGroup value={category} options={CATEGORIES} onChange={setCategory} />
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">你使用什么设备？</legend>
        <OptionGroup value={device} options={DEVICES} onChange={setDevice} />
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-medium">每周想留多少时间？</legend>
        <OptionGroup
          value={minutes}
          options={TIMES}
          onChange={setMinutes}
          format={(item) => Number(item) >= 40 ? "40分钟以上" : `${item}分钟`}
        />
      </fieldset>
      {initial && (
        <fieldset className="preference-reminder">
          <div className="flex items-center justify-between gap-4">
            <div>
              <legend className="text-sm font-medium">每周提醒</legend>
              <p className="mt-1 text-xs text-muted">最多两次，完成后停止。</p>
            </div>
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
            <div className="mt-4 flex flex-wrap gap-2">
              {DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  className={`preference-day${practiceDay === index + 1 ? " preference-day--selected" : ""}`}
                  onClick={() => setPracticeDay(index + 1)}
                >
                  {day}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <button className="preference-save" type="submit" disabled={submitting}>
        {submitting ? "正在保存…" : submitText}
      </button>
    </form>
  );
}
