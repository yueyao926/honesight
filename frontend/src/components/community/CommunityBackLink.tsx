import { Link } from "react-router-dom";
import arrow28Svg from "../../SVG/arrow-28.svg?url";

type CommunityBackLinkProps = {
  className?: string;
};

export default function CommunityBackLink({ className = "" }: CommunityBackLinkProps) {
  return (
    <Link
      to="/community"
      className={`community-back-link ${className}`.trim()}
      aria-label="返回社区主页"
    >
      <img
        src={arrow28Svg}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="community-back-link__icon"
      />
      <span className="community-back-link__label">返回社区</span>
    </Link>
  );
}
