import { Link } from "react-router-dom";
import misc27Svg from "../../SVG/misc-27.svg?url";
import misc17Svg from "../../SVG/misc-17.svg?url";
import misc31Svg from "../../SVG/misc-31.svg?url";
import arrow31Svg from "../../SVG/arrow-31.svg?url";
import misc58Svg from "../../SVG/misc-58.svg?url";

type HomeIcon = {
  id: string;
  label: string;
  to: string;
  delay: string;
  iconSrc: string;
};

const icons: HomeIcon[] = [
  {
    id: "camera",
    label: "camera",
    to: "/ai",
    delay: "0s",
    iconSrc: misc27Svg,
  },
  {
    id: "film",
    label: "film",
    to: "/portfolio",
    delay: "0.5s",
    iconSrc: misc17Svg,
  },
  {
    id: "ai",
    label: "AI",
    to: "/profile",
    delay: "1s",
    iconSrc: misc31Svg,
  },
  {
    id: "progress",
    label: "progress",
    to: "/practice",
    delay: "1.5s",
    iconSrc: arrow31Svg,
  },
  {
    id: "community",
    label: "community",
    to: "/community",
    delay: "2s",
    iconSrc: misc58Svg,
  },
];

export default function HomeFeatureIcons() {
  return (
    <div className="flex flex-wrap items-end justify-center gap-5 sm:gap-8 md:gap-10">
      {icons.map((icon) => (
        <Link
          key={icon.id}
          to={icon.to}
          className="home-icon-chip"
          aria-label={icon.label}
        >
          <span className="home-icon-chip-label">{icon.label}</span>
          <span
            className="home-icon-chip-box animate-wobble"
            style={{ animationDelay: icon.delay }}
          >
            <img
              src={icon.iconSrc}
              alt=""
              className="h-8 w-8 object-contain sm:h-9 sm:w-9"
              draggable={false}
            />
          </span>
        </Link>
      ))}
    </div>
  );
}
