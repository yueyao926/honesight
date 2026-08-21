import hangtagImg from "../../SVG/标签.png";
import { useCallback, useEffect, useRef, useState } from "react";
import "./HomeHangtag.css";

const MAX_SWING = 42;
const IDLE_AMP_A = 4.2;
const IDLE_AMP_B = 1.6;
const IDLE_SPEED_A = 1.35;
const IDLE_SPEED_B = 2.15;

function idleSway(nowMs: number) {
  const t = nowMs / 1000;
  return (
    Math.sin(t * IDLE_SPEED_A) * IDLE_AMP_A +
    Math.sin(t * IDLE_SPEED_B + 0.9) * IDLE_AMP_B
  );
}

export default function HomeFilmLanyard() {
  const figureRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const targetRef = useRef(0);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const lastPointerRef = useRef<{ x: number; t: number } | null>(null);
  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let frame = 0;

    const tick = (now: number) => {
      const dragging = draggingRef.current;
      const target = dragging ? targetRef.current : idleSway(now);
      const stiffness = dragging ? 0.22 : 0.035;
      const damping = dragging ? 0.68 : 0.82;

      velocityRef.current += (target - angleRef.current) * stiffness;
      velocityRef.current *= damping;
      angleRef.current += velocityRef.current;

      setAngle(angleRef.current);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateAngle = useCallback((clientX: number, clientY: number) => {
    const figure = figureRef.current;
    if (!figure) return;

    const rect = figure.getBoundingClientRect();
    const pivotX = rect.left + rect.width / 2;
    const pivotY = rect.top;
    const dx = clientX - pivotX;
    const dy = Math.max(clientY - pivotY, 48);
    const next = Math.atan2(dx, dy) * (180 / Math.PI);
    targetRef.current = Math.max(-MAX_SWING, Math.min(MAX_SWING, -next));

    const last = lastPointerRef.current;
    const now = performance.now();
    if (last) {
      const dt = Math.max(now - last.t, 8);
      const vx = (clientX - last.x) / dt;
      velocityRef.current += vx * 0.06;
    }
    lastPointerRef.current = { x: clientX, t: now };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      velocityRef.current = 0;
      lastPointerRef.current = { x: event.clientX, t: performance.now() };
      event.currentTarget.setPointerCapture(event.pointerId);
      updateAngle(event.clientX, event.clientY);
    },
    [updateAngle],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      updateAngle(event.clientX, event.clientY);
    },
    [updateAngle],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    lastPointerRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <aside className="home-hangtag-root" aria-label="牛皮纸吊牌">
      <div
        className="home-hangtag-pivot"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={figureRef}
          className="home-hangtag-figure"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <img className="home-hangtag-image" src={hangtagImg} alt="" draggable={false} />
        </div>
      </div>
    </aside>
  );
}
