import { useEffect, useState } from "react";
import PageLoader from "./PageLoader";

type DeferredPageLoaderProps = {
  variant?: "fullscreen" | "route";
  delayMs?: number;
};

export default function DeferredPageLoader({
  variant = "route",
  delayMs = 80,
}: DeferredPageLoaderProps) {
  const [show, setShow] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!show) {
    return <div className="route-suspense-placeholder" aria-busy="true" aria-live="polite" />;
  }

  return <PageLoader variant={variant} />;
}
