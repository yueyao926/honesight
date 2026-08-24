import cameraSvg from "../../SVG/camera-white-lines.svg?url";

function ClickSquiggle() {
  return (
    <svg
      className="practice-task-hero-click-squiggle"
      viewBox="0 0 20 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3.5 2.5C6.5 1.5 8.5 6.5 11.5 10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClickUnderline() {
  return (
    <svg
      className="practice-task-hero-click-underline"
      viewBox="0 0 72 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 6.5C18 4.5 34 7.5 52 5.5C58 4.8 64 5.2 68 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClickSparkles() {
  return (
    <div className="practice-task-hero-click-sparkles" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export default function PracticeTaskHeroCameraArt() {
  return (
    <div className="practice-task-hero-camera-art" aria-hidden="true">
      <div className="practice-task-hero-camera-stage">
        <img src={cameraSvg} alt="" className="practice-task-hero-camera" draggable={false} />
        <div className="practice-task-hero-shutter-burst">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="practice-task-hero-click">
        <ClickSquiggle />
        <span className="practice-task-hero-click-text">click~</span>
        <ClickUnderline />
        <ClickSparkles />
      </div>
    </div>
  );
}
