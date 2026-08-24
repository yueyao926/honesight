import { useId } from "react";
import "./PracticeGoalSparkleLoader.css";

const STAR_PATH =
  "M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z";

function SparkleStar({ idPrefix, className }: { idPrefix: string; className: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <filter id={`${idPrefix}-shine`}>
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <mask id={`${idPrefix}-mask`}>
          <path d={STAR_PATH} fill="white" />
        </mask>
        <radialGradient
          id={`${idPrefix}-gradient-1`}
          cx="50"
          cy="66"
          fx="50"
          fy="66"
          r="30"
          gradientTransform="translate(0 35) scale(1 0.5)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="black" stopOpacity="0.3" />
          <stop offset="50%" stopColor="black" stopOpacity="0.1" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-gradient-2`} cx="55" cy="20" fx="55" fy="20" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.3" />
          <stop offset="50%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-gradient-3`} cx="85" cy="50" fx="85" fy="50" href={`#${idPrefix}-gradient-2`} />
        <radialGradient
          id={`${idPrefix}-gradient-4`}
          cx="50"
          cy="58"
          fx="50"
          fy="58"
          r="60"
          gradientTransform="translate(0 47) scale(1 0.2)"
          href={`#${idPrefix}-gradient-3`}
        />
        <linearGradient id={`${idPrefix}-gradient-5`} x1="50" y1="90" x2="50" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="black" stopOpacity="0.2" />
          <stop offset="40%" stopColor="black" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g>
        <path d={STAR_PATH} fill="currentColor" />
        <path d={STAR_PATH} fill={`url(#${idPrefix}-gradient-1)`} />
        <path
          d={STAR_PATH}
          fill="none"
          stroke="white"
          opacity="0.3"
          strokeWidth="3"
          filter={`url(#${idPrefix}-shine)`}
          mask={`url(#${idPrefix}-mask)`}
        />
        <path d={STAR_PATH} fill={`url(#${idPrefix}-gradient-2)`} />
        <path d={STAR_PATH} fill={`url(#${idPrefix}-gradient-3)`} />
        <path d={STAR_PATH} fill={`url(#${idPrefix}-gradient-4)`} />
        <path d={STAR_PATH} fill={`url(#${idPrefix}-gradient-5)`} />
      </g>
    </svg>
  );
}

export default function PracticeGoalSparkleLoader() {
  const uid = useId().replace(/:/g, "");

  return (
    <div className="practice-goal-sparkle-loader" aria-hidden="true">
      <SparkleStar idPrefix={`${uid}-one`} className="practice-goal-sparkle-loader__star practice-goal-sparkle-loader__star--one" />
      <SparkleStar idPrefix={`${uid}-two`} className="practice-goal-sparkle-loader__star practice-goal-sparkle-loader__star--two" />
      <SparkleStar idPrefix={`${uid}-three`} className="practice-goal-sparkle-loader__star practice-goal-sparkle-loader__star--three" />
    </div>
  );
}
