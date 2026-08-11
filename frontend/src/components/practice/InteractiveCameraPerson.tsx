import { useEffect, useMemo, useRef } from "react";
import {
  Alignment,
  EventType,
  Fit,
  Layout,
  useRive,
} from "@rive-app/react-canvas";

/** Near-white artboard fill in the marketplace Rive asset. */
const WHITE_KEY_THRESHOLD = 242;
/** Top/bottom margin where decorative gray bars live (fraction of height). */
const MARGIN_BAND = 0.2;

function shouldKeyPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  y: number,
  height: number,
) {
  if (a < 12) return true;

  if (
    r >= WHITE_KEY_THRESHOLD &&
    g >= WHITE_KEY_THRESHOLD &&
    b >= WHITE_KEY_THRESHOLD
  ) {
    return true;
  }

  const inMargin = y < height * MARGIN_BAND || y > height * (1 - MARGIN_BAND);
  if (!inMargin) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  return luminance >= 212 && saturation < 0.14;
}

function keyWhiteBackground(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (
        shouldKeyPixel(data[i], data[i + 1], data[i + 2], data[i + 3], y, height)
      ) {
        data[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

const RIVE_SRC = "/rive/interactive-character-follow.riv";
const ARTBOARD = "Main artboard";
const STATE_MACHINE = "State Machine 1";

type InteractiveCameraPersonProps = {
  className?: string;
};

function isStaticDevice() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 767px)").matches
  );
}

export default function InteractiveCameraPerson({
  className = "",
}: InteractiveCameraPersonProps) {
  const staticRef = useRef(isStaticDevice());

  const layout = useMemo(
    () =>
      new Layout({
        fit: Fit.Cover,
        alignment: Alignment.Center,
      }),
    [],
  );

  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const { RiveComponent, rive, canvas } = useRive(
    {
      src: RIVE_SRC,
      artboard: ARTBOARD,
      stateMachines: STATE_MACHINE,
      autoplay: !staticRef.current,
      autoBind: true,
      layout,
    },
    { useOffscreenRenderer: false },
  );

  useEffect(() => {
    if (!rive || !canvas) return;

    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    const ctx = displayCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const keyFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return;

      if (displayCanvas.width !== width) displayCanvas.width = width;
      if (displayCanvas.height !== height) displayCanvas.height = height;

      keyWhiteBackground(ctx, canvas, width, height);
    };

    rive.on(EventType.Advance, keyFrame);
    keyFrame();

    return () => {
      rive.off(EventType.Advance, keyFrame);
    };
  }, [rive, canvas]);

  useEffect(() => {
    if (!rive) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const narrowViewport = window.matchMedia("(max-width: 767px)");

    const syncPlayback = () => {
      staticRef.current = isStaticDevice();
      if (staticRef.current) {
        rive.pause();
        return;
      }
      rive.play(STATE_MACHINE);
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    coarsePointer.addEventListener("change", syncPlayback);
    narrowViewport.addEventListener("change", syncPlayback);

    return () => {
      reducedMotion.removeEventListener("change", syncPlayback);
      coarsePointer.removeEventListener("change", syncPlayback);
      narrowViewport.removeEventListener("change", syncPlayback);
    };
  }, [rive]);

  useEffect(() => {
    if (!rive || !canvas || staticRef.current) return;

    const forwardPointer = (clientX: number, clientY: number) => {
      // Rive registers mousemove/mouseover — not pointermove.
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX,
          clientY,
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      forwardPointer(event.clientX, event.clientY);
    };

    const resetPointer = () => {
      const rect = canvas.getBoundingClientRect();
      forwardPointer(rect.left + rect.width / 2, rect.top + rect.height * 0.45);
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("mouseleave", resetPointer);
    resetPointer();

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mouseleave", resetPointer);
    };
  }, [rive, canvas]);

  return (
    <div
      className={`interactive-camera-person ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="interactive-camera-person__stage">
        <RiveComponent className="interactive-camera-person__rive interactive-camera-person__rive--source" />
        <canvas
          ref={displayCanvasRef}
          className="interactive-camera-person__display"
        />
      </div>
    </div>
  );
}
