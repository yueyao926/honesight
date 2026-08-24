import icon11 from "../../SVG/11.svg?url";
import icon12 from "../../SVG/12.svg?url";
import icon13 from "../../SVG/13.svg?url";
import icon14 from "../../SVG/14.svg?url";
import icon15 from "../../SVG/15.svg?url";
import icon16 from "../../SVG/16.svg?url";

const PRACTICE_THEME_ICONS = [icon11, icon12, icon13, icon14, icon15, icon16];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function assignPracticeThemeIcons(sessionIds: number[], weekKey?: string) {
  const sortedIds = [...sessionIds].sort((a, b) => a - b);
  const seed = hashString(`${weekKey || "practice"}:${sortedIds.join(",")}`);
  const shuffled = seededShuffle(PRACTICE_THEME_ICONS, seed);
  const icons = new Map<number, string>();
  sortedIds.forEach((id, index) => {
    icons.set(id, shuffled[index]);
  });
  return icons;
}
