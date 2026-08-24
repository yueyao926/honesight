import "./PortfolioTitleStars.css";

const STAR_PATH =
  "M234.5,114.38l-45.1,39.36,13.51,58.6a16,16,0,0,1-23.84,17.34l-51.11-31-51,31a16,16,0,0,1-23.84-17.34L66.61,153.8,21.5,114.38a16,16,0,0,1,9.11-28.06l59.46-5.15,23.21-55.36a15.95,15.95,0,0,1,29.44,0h0L166,81.17l59.44,5.15a16,16,0,0,1,9.11,28.06Z";

const STARS = [
  { className: "portfolio-title-stars__star portfolio-title-stars__star--1", size: 32 },
  { className: "portfolio-title-stars__star portfolio-title-stars__star--2", size: 32 },
  { className: "portfolio-title-stars__star portfolio-title-stars__star--3", size: 32 },
] as const;

export default function PortfolioTitleStars() {
  return (
    <span className="portfolio-title-stars" aria-hidden="true">
      {STARS.map((star, index) => (
        <svg
          key={index}
          viewBox="0 0 256 256"
          className={star.className}
          height={star.size}
          width={star.size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
