const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/login": () => import("../pages/Login"),
  "/register": () => import("../pages/Register"),
  "/practice": () => import("../pages/Practice"),
  "/ai": () => import("../pages/AiStudio"),
  "/portfolio": () => import("../pages/Portfolio"),
  "/community": () => import("../pages/Community"),
  "/profile": () => import("../pages/Profile"),
  "/dashboard": () => import("../pages/Dashboard"),
  "/settings": () => import("../pages/Settings"),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string) {
  const normalized = path.split("?")[0].split("#")[0];
  const loader =
    routeLoaders[normalized] ||
    (normalized.startsWith("/portfolio/") ? routeLoaders["/portfolio"] : undefined) ||
    (normalized.startsWith("/practice") ? routeLoaders["/practice"] : undefined) ||
    (normalized.startsWith("/community") ? routeLoaders["/community"] : undefined);

  if (!loader || prefetched.has(normalized)) return;
  prefetched.add(normalized);
  void loader();
}

export function prefetchCommonRoutes() {
  ["/practice", "/ai", "/portfolio", "/community", "/profile"].forEach(prefetchRoute);
}

export function routePrefetchHandlers(path: string) {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onFocus: () => prefetchRoute(path),
    onTouchStart: () => prefetchRoute(path),
  };
}
