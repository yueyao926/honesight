import { useEffect, useRef } from "react";
import cradleSvg from "../SVG/牛顿摆.svg?raw";
import "./NewtonCradle.css";

export default function NewtonCradle({ hoverOnly = false }: { hoverOnly?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    wrap.innerHTML = cradleSvg;

    const svg = wrap.querySelector("svg");
    if (!svg) return;

    if (hoverOnly) {
      svg.classList.add("hover-only");
    }

    return () => {
      wrap.innerHTML = "";
    };
  }, [hoverOnly]);

  return (
    <div
      className="newton-cradle-wrap"
      ref={wrapRef}
      aria-hidden="true"
    />
  );
}
