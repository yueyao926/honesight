import { getAssetUrl } from "../api/client";

const STYLE_FILTERS: Array<[string, string]> = [
  ["黑白", "grayscale(1) contrast(1.12) brightness(1.01)"],
  ["赛博朋克", "brightness(.94) contrast(1.2) saturate(1.35) hue-rotate(12deg)"],
  ["暗调", "brightness(.82) contrast(1.16) saturate(.82)"],
  ["明亮通透", "brightness(1.12) contrast(.94) saturate(.96)"],
  ["清新自然", "brightness(1.08) contrast(.92) saturate(.9) hue-rotate(-3deg)"],
  ["日系", "brightness(1.09) contrast(.88) saturate(.8) sepia(.06) hue-rotate(-5deg)"],
  ["韩系", "brightness(1.1) contrast(.9) saturate(.86) sepia(.04)"],
  ["胶片", "brightness(1.01) contrast(1.06) saturate(.76) sepia(.16) hue-rotate(7deg)"],
  ["电影", "brightness(.96) contrast(1.14) saturate(.82) sepia(.08)"],
  ["复古", "brightness(.97) contrast(1.08) saturate(.7) sepia(.24)"],
  ["港风", "brightness(.94) contrast(1.17) saturate(1.08) sepia(.1)"],
  ["法式", "brightness(1.06) contrast(.92) saturate(.82) sepia(.1)"],
  ["森系", "brightness(1.01) contrast(.93) saturate(.83) hue-rotate(10deg)"],
  ["莫兰迪", "brightness(1.04) contrast(.9) saturate(.62) sepia(.05)"],
  ["高级灰", "brightness(1.01) contrast(.96) saturate(.52) grayscale(.12)"],
  ["低饱和", "brightness(1.02) contrast(.96) saturate(.58)"],
  ["高饱和", "brightness(1.03) contrast(1.1) saturate(1.28)"],
  ["纪实", "brightness(1.01) contrast(1.09) saturate(.82)"],
  ["人像", "brightness(1.07) contrast(.94) saturate(.9) sepia(.04)"],
  ["生活记录", "brightness(1.05) contrast(.93) saturate(.9)"],
  ["商业", "brightness(1.04) contrast(1.12) saturate(.96)"],
  ["极简", "brightness(1.1) contrast(.95) saturate(.72)"],
];

export function getQuickPreviewFilter(targetStyle: string): string {
  return STYLE_FILTERS.find(([key]) => targetStyle.includes(key))?.[1]
    || "brightness(1.05) contrast(.94) saturate(.9)";
}

function targetRatio(platform: string, sourceRatio: number): number {
  if (platform === "抖音") return 9 / 16;
  if (["小红书", "Instagram"].includes(platform)) return 4 / 5;
  return sourceRatio;
}

export async function createQuickPreviewFile(
  imageUrl: string,
  targetStyle: string,
  targetPlatform: string,
): Promise<File> {
  const response = await fetch(getAssetUrl(imageUrl));
  if (!response.ok) throw new Error("无法读取原图，请重新上传");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const sourceRatio = bitmap.width / bitmap.height;
    const ratio = targetRatio(targetPlatform, sourceRatio);
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;
    if (sourceRatio > ratio) sourceWidth = Math.round(sourceHeight * ratio);
    else if (sourceRatio < ratio) sourceHeight = Math.round(sourceWidth / ratio);
    const sourceX = Math.round((bitmap.width - sourceWidth) / 2);
    const sourceY = Math.round((bitmap.height - sourceHeight) / 2);
    const scale = Math.min(1, 2400 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法生成快速预览文件");
    context.filter = getQuickPreviewFilter(targetStyle);
    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("快速预览导出失败")), "image/jpeg", 0.92);
    });
    return new File([blob], `quick-preview-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
