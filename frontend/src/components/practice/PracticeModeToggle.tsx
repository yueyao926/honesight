import { useId, type ReactNode } from "react";

const VECTOR4_PATH =
  "M362.702 142.885C328.731 117.77 265.768 86.6616 211.116 112.96C193.771 121.306 186.139 131.34 191.586 144.047C195.752 153.767 220.343 165.329 238.228 165.329C245.794 165.329 238.283 158.382 236.187 156.351C229.376 149.748 205.173 150.422 194.209 150.366C170.172 150.243 127.824 146.412 106.756 154.521C78.1591 165.531 71.4828 182.613 71.4828 201.073C71.4828 216.572 74.6451 235.687 96.407 246.791C111.535 254.51 149.34 252.111 167.973 252.111C177.825 252.111 189.5 249.378 186.776 242.386C185.292 238.578 175.149 237.714 170.014 236.815C150.437 233.39 130.915 229.852 110.254 229.668C94.0487 229.522 86.0635 234.59 74.1064 240.474C45.4507 254.573 37.5645 280.853 34.1696 300.988C30.4309 323.164 19.5845 371.496 74.1064 377.049C76.9184 377.335 93.5058 375.94 86.9329 375.136C72.8999 373.422 56.1563 374.804 41.8947 374.804C32.8535 374.804 16.4304 372.944 10.9945 378.627C-5.10069 395.456 7.8806 414.162 20.4686 430.748C36.4064 451.748 60.9656 468.109 92.0345 482.285C115.136 492.824 162.419 489.985 189.106 486.94C211.158 484.424 244.64 477.183 244.64 461.753C244.64 457.615 225.603 452.828 223.798 456.433C219.766 464.481 236.57 471.216 246.681 474.72C283.692 487.55 330.492 496.788 373.196 500.822C429.777 506.165 502.524 510.741 555.683 494.837C576.761 488.53 635.831 463.423 609.32 446.625C603.949 443.222 582.855 441.599 580.607 447.373C577.679 454.885 620.895 460.079 628.414 460.921C675.245 466.167 720.195 470.837 767.903 472.809C817.468 474.857 883.504 463.776 916.572 441.636C943.007 423.94 931.628 399.804 904.912 385.112C900.56 382.718 857.257 364.41 858.561 377.797C859.571 388.157 906.822 391.541 918.613 393.424C946.297 397.845 986.464 402.911 1012.19 391.595C1019.19 388.513 1024.24 380.931 1028.07 376.633C1040.36 362.879 1051.75 350.52 1048.33 334.572C1044.72 317.712 1031.41 302.525 1019.18 287.273C1014.06 280.878 1008.96 271.973 998.194 267.738C988.72 264.013 969.469 271.977 966.711 277.214C960.375 289.26 984.174 298.813 1000.24 302.65C1032.18 310.286 1056.03 307.394 1082.15 295.087C1098.53 287.368 1116.01 276.43 1121.79 264.414C1128.78 249.913 1122.21 230.749 1118.01 216.367C1107.58 180.677 1070.98 152.667 1013.64 136.318C963.272 121.954 943.862 168.613 994.988 175.802C1020.82 179.434 1067.55 176.172 1075.15 158.18C1080.38 145.821 1077.44 128.902 1073.11 116.7C1065.77 96.0012 1044.96 81.3663 1019.18 66.742C977.221 42.9306 933.475 24.2917 871.97 28.0054C846.223 29.56 820.133 37.6159 813.816 52.0278C809.017 62.9714 806.1 75.3409 811.919 86.3594C812.966 88.3389 818.2 99.4172 823.872 99.0775C839.648 98.1304 864.979 91.1788 878.094 86.1933C893.279 80.4192 907.224 71.9115 899.956 61.0891C881.358 33.3949 832.758 8.72618 781.165 4.73028C738.723 1.44316 684.58 4.52379 646.779 16.6174C614.218 27.0343 594.161 42.0568 594.161 64.3315C594.161 69.9215 600.365 99.4935 615.879 99.4935C638.268 99.4935 640.454 69.733 637.888 62.4193C629.495 38.4867 590.091 24.2872 550.727 19.8583C511.759 15.4743 455.892 8.94014 424.212 27.0074C390.068 46.4797 383.323 69.4203 383.69 95.6691C383.89 109.903 381.421 121.414 409.926 118.279C423.543 116.783 436.162 114.309 436.162 105.479C436.162 97.1578 429.194 99.284 416.485 100.99C404.621 102.582 401.972 104.883 394.332 109.967C386.579 115.125 378.593 123.422 375.967 130.167C374.332 134.359 367.807 137.141 365.325 141.389";

const VECTOR4_VIEWBOX = "0 0 1129 510";

type PracticeMode = "improve" | "category";

type PracticeModeToggleProps = {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
};

function Vector4Border({ filterId, muted }: { filterId: string; muted?: boolean }) {
  return (
    <svg
      className={`home-drawn-btn-border practice-mode-toggle__border ${muted ? "practice-mode-toggle__border--muted" : ""}`}
      viewBox={VECTOR4_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g filter={`url(#${filterId})`}>
        <path
          d={VECTOR4_PATH}
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      <defs>
        <filter
          id={filterId}
          x="-8"
          y="0"
          width="1145"
          height="515"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2.5" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}

function ModeTab({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const filterId = `practice-vector4-${useId().replace(/:/g, "")}`;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`home-drawn-btn home-drawn-btn--pill ${selected ? "is-selected" : "is-idle"}`}
    >
      <Vector4Border filterId={filterId} muted={!selected} />
      <span className="home-drawn-btn-label">{children}</span>
    </button>
  );
}

export default function PracticeModeToggle({ mode, onChange }: PracticeModeToggleProps) {
  return (
    <div className="home-drawn-btn-group practice-mode-toggle" role="tablist" aria-label="练习方式">
      <ModeTab selected={mode === "improve"} onClick={() => onChange("improve")}>
        改进这张
      </ModeTab>
      <ModeTab selected={mode === "category"} onClick={() => onChange("category")}>
        分类练习
      </ModeTab>
    </div>
  );
}
