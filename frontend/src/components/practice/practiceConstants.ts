import type { PracticeSession } from "../../types";

export type AbilityValue = "构图" | "光线" | "清晰度" | "色彩" | "不确定";

export const ABILITIES: Array<{ value: AbilityValue; title: string; description: string }> = [
  { value: "不确定", title: "帮我推荐", description: "结合连续训练和最近练习安排" },
  { value: "构图", title: "让主体更突出", description: "练习画面主次与空间安排" },
  { value: "光线", title: "让明暗更舒服", description: "观察并控制光线方向与亮度" },
  { value: "清晰度", title: "把关键位置拍清楚", description: "练习对焦、稳定和细节表现" },
  { value: "色彩", title: "让颜色自然统一", description: "控制主色、肤色和环境杂色" },
];

export const CATEGORIES = ["人像", "风景", "拍物"] as const;

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  人像: "人物",
  风景: "风景与街景",
  拍物: "物品与食物",
};

export function formatWeekLabel(weekKey: string | undefined) {
  const matched = weekKey?.match(/^(\d{4})-W(\d{2})$/);
  return matched ? `${matched[1]} 年 · 第 ${Number(matched[2])} 周` : "LensCoach";
}

export type DifficultyValue = "too_easy" | "just_right" | "too_hard";

export const MAX_PRACTICE_ROUNDS = 3;

export const DIFFICULTY_OPTIONS: Array<[DifficultyValue, string]> = [
  ["too_easy", "太简单"],
  ["just_right", "正合适"],
  ["too_hard", "太难"],
];

export const DIFFICULTY_CONFIRMATIONS: Record<DifficultyValue, string> = {
  too_easy: "已记录：太简单。连续轻松达成后，后续练习会适当升级。",
  just_right: "已记录：正合适。下一次会继续当前节奏。",
  too_hard: "已记录：太难。已为你准备 10 分钟简化版。",
};

export function getOverviewSessions(overview: { current_sessions?: PracticeSession[]; current?: PracticeSession | null } | null) {
  return overview?.current_sessions || (overview?.current ? [overview.current] : []);
}
