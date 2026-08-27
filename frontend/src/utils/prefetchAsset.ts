import { getAssetUrl } from "../api/client";

const prefetched = new Set<string>();

export function prefetchAsset(path: string) {
  const url = getAssetUrl(path);
  if (!url || prefetched.has(url)) return;
  prefetched.add(url);

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "image";
  link.href = url;
  document.head.appendChild(link);
}

export function prefetchAssets(paths: string[]) {
  paths.forEach(prefetchAsset);
}
