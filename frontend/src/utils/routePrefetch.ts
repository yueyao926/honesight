import { prefetchCommunityFeed } from "./communityFeedPrefetch";

const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/login": () => import("../pages/Login"),
  "/register": () => import("../pages/Register"),
  "/practice": () => import("../pages/Practice"),
  "/practice/add": () => import("../pages/PracticeAdd"),
  "/ai": () => import("../pages/AiStudio"),
  "/portfolio": () => import("../pages/Portfolio"),
  "/community": () => import("../pages/Community"),
  "/profile": () => import("../pages/Profile"),
  "/dashboard": () => import("../pages/Dashboard"),
  "/settings": () => import("../pages/Settings"),
};

const prefetchPromises = new Map<string, Promise<unknown>>();

function resolveLoader(path: string) {
  const normalized = path.split("?")[0].split("#")[0];
  return (
    routeLoaders[normalized] ||
    (normalized.startsWith("/portfolio/") ? routeLoaders["/portfolio"] : undefined) ||
    (normalized.startsWith("/practice/") ? routeLoaders["/practice"] : undefined) ||
    (normalized.startsWith("/community") ? routeLoaders["/community"] : undefined)
  );
}

export function prefetchRoute(path: string) {
  const normalized = path.split("?")[0].split("#")[0];
  const loader = resolveLoader(path);
  if (!loader) return;

  let promise = prefetchPromises.get(normalized);
  if (!promise) {
    promise = loader().catch((error) => {
      prefetchPromises.delete(normalized);
      throw error;
    });
    prefetchPromises.set(normalized, promise);
  }

  if (normalized === "/community" || normalized.startsWith("/community")) {
    prefetchCommunityFeed("recommended");
  }

  return promise;
}

export function prefetchCommonRoutes() {
  ["/dashboard", "/practice", "/ai", "/portfolio", "/community", "/profile"].forEach(prefetchRoute);
}

export function routePrefetchHandlers(path: string) {
  const prefetch = () => {
    void prefetchRoute(path);
  };
  return {
    onMouseEnter: prefetch,
    onFocus: prefetch,
    onTouchStart: prefetch,
    onPointerDown: prefetch,
  };
}
