import { Link } from "react-router-dom";

export default function CommunityPublishButton() {
  return (
    <>
      <Link className="community-gooey-button community-gooey-button--fill" to="/community/post/create">
        发布
        <span className="community-gooey-button__blobs" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </Link>

      <svg style={{ display: "block", height: 0, width: 0 }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="community-goo">
            <feGaussianBlur result="blur" stdDeviation="10" in="SourceGraphic" />
            <feColorMatrix
              result="goo"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              mode="matrix"
              in="blur"
            />
            <feBlend in2="goo" in="SourceGraphic" />
          </filter>
        </defs>
      </svg>
    </>
  );
}
