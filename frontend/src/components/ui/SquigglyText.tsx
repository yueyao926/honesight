import {
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type SquigglyTextProps = {
  children: ReactNode;
  steps?: number;
  stepDuration?: number;
  scale?: number | [number, number];
  baseFrequency?: number;
  numOctaves?: number;
  as?: "span" | "div";
  className?: string;
  style?: CSSProperties;
};

export default function SquigglyText({
  children,
  steps = 5,
  stepDuration = 80,
  scale = [6, 8],
  baseFrequency = 0.02,
  numOctaves = 3,
  as: Component = "span",
  className,
  style,
}: SquigglyTextProps) {
  const uid = useId().replace(/:/g, "");
  const [step, setStep] = useState(0);
  const [motionEnabled, setMotionEnabled] = useState(true);

  const scales = useMemo(
    () =>
      Array.from({ length: steps }, (_, index) => {
        if (typeof scale === "number") return scale;
        return index % 2 === 0 ? scale[0] : scale[1];
      }),
    [scale, steps],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionEnabled(!media.matches);
    syncMotion();
    media.addEventListener("change", syncMotion);
    return () => media.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    if (!motionEnabled) return undefined;

    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % steps);
    }, stepDuration);

    return () => window.clearInterval(timer);
  }, [motionEnabled, stepDuration, steps]);

  const activeFilterId = `${uid}-squiggly-${step}`;

  return (
    <>
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0 overflow-hidden">
        <defs>
          {Array.from({ length: steps }, (_, index) => (
            <filter
              key={index}
              id={`${uid}-squiggly-${index}`}
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={baseFrequency}
                numOctaves={numOctaves}
                seed={index}
                result="noise"
              />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={scales[index]} />
            </filter>
          ))}
        </defs>
      </svg>

      <Component
        className={className}
        style={{
          ...style,
          display: "inline-block",
          filter: motionEnabled ? `url(#${activeFilterId})` : undefined,
        }}
      >
        {children}
      </Component>
    </>
  );
}
