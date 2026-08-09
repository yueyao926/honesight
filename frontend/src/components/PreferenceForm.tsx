import { FormEvent } from "react";
import type { Preference } from "../types";

const fields = [
  ["skill_level", "摄影水平", "新手 / 有一点基础 / 进阶"],
  ["target_platform", "主要发布平台", "小红书 / 朋友圈 / Instagram / 作品集 / 商业约拍"],
  ["preferred_styles", "偏好风格", "清新自然, 日系, 胶片感"],
  ["common_subjects", "常拍内容", "人像, 风景, 美食, 校园"],
  ["improvement_goals", "想提升能力", "构图, 光线, 调色"],
  ["editing_tools", "常用修图工具", "Lightroom, 醒图, VSCO"],
] as const;

export default function PreferenceForm({
  initial,
  onSubmit,
  submitText,
}: {
  initial?: Partial<Preference> | null;
  onSubmit: (payload: Record<string, string>) => Promise<void>;
  submitText: string;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {};
    fields.forEach(([key]) => {
      payload[key] = String(form.get(key) || "");
    });
    await onSubmit(payload);
  }

  return (
    <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
      {fields.map(([key, label, placeholder]) => (
        <div key={key}>
          <label className="label">{label}</label>
          <input className="input" name={key} defaultValue={(initial?.[key] as string) || ""} placeholder={placeholder} />
        </div>
      ))}
      <div className="md:col-span-2">
        <button className="btn-primary" type="submit">{submitText}</button>
      </div>
    </form>
  );
}
