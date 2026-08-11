import type { FormHTMLAttributes, ReactNode } from "react";

const BOX4_HD_PATH =
  "M2003.35 316.133C1827.96 316.133 1652.59 316.133 1477.2 316.133C1296.18 316.133 1115.44 322.788 934.285 322.788C819.7 322.788 703.54 319.051 589.117 322.973C547.491 324.4 515.442 324.498 474.059 320.94C438.611 317.892 386.738 309.005 351.212 312.99C337.623 314.515 351.145 393.313 351.512 396.554C358.27 456.21 372.781 515.177 385.669 574.4C412.605 698.175 436.197 822.645 456.081 946.921C476.471 1074.36 489.388 1205.4 465.07 1332.94C457.359 1373.37 460.875 1414.72 460.875 1455.51C460.875 1486.4 465.7 1516.89 466.268 1547.76C466.52 1561.41 463.345 1575.14 488.441 1569.2C523.286 1560.95 559.885 1557.16 596.904 1554.78C714.639 1547.22 834.688 1547.53 952.859 1547.94C1352.54 1549.35 1750.73 1574.01 2150.76 1574.01C2263.43 1574.01 2376.39 1571.86 2488.74 1576.6C2537.98 1578.67 2543.09 1580.67 2533.08 1551.45C2524.13 1525.3 2520.26 1498.19 2516.9 1471.59C2503.96 1368.95 2505.95 1265.33 2505.22 1162.48C2503.92 978.641 2515.43 795.64 2519.9 611.93C2522.32 512.315 2510.31 413.099 2510.31 313.545C2510.31 303.87 2510.31 294.195 2510.31 284.52C2510.31 265.609 2471.2 268.293 2446.19 266.217C2201.75 245.925 1956.36 231.633 1711.21 215.192C1643.07 210.622 1570.46 199.663 1501.77 199.663";

const BOX4_HD_VIEWBOX = "326 296 2229 1295";

type PracticeDrawnCardProps = FormHTMLAttributes<HTMLFormElement> & {
  children: ReactNode;
  frameClassName?: string;
  art?: ReactNode;
};

export default function PracticeDrawnCard({
  children,
  art,
  className = "",
  frameClassName = "",
  ...formProps
}: PracticeDrawnCardProps) {
  return (
    <div className={`practice-drawn-card-frame ${frameClassName}`.trim()}>
      <form className={`practice-drawn-card-inner ${className}`.trim()} {...formProps}>
        <div className="practice-drawn-card-layout">
          <div className="practice-drawn-card-main">{children}</div>
          <aside className="practice-drawn-card-art" aria-hidden="true">
            {art}
          </aside>
        </div>
      </form>
      <svg
        className="practice-drawn-card-border"
        viewBox={BOX4_HD_VIEWBOX}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={BOX4_HD_PATH}
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
