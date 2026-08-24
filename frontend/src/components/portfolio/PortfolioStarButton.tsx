import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./PortfolioStarButton.css";

type PortfolioStarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function PortfolioStarButton({
  children,
  className = "",
  type = "button",
  ...props
}: PortfolioStarButtonProps) {
  const classes = ["portfolio-star-button", className].filter(Boolean).join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
      <svg
        className="portfolio-star-button__stars"
        viewBox="0 0 353 178"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M271 37.9914C289.244 33.3118 295.91 27.0769 299.991 9C305.137 29.7552 312.313 36.1206 331.104 40.1127C312.194 43.8462 305.081 49.4282 302.113 69.1041C296.925 50.845 289.057 44.9589 271 37.9914Z" />
        <path d="M254.852 83.012C245.919 73.8857 239.998 72.0853 228 75.817C238.443 65.759 239.748 59.3874 235.721 47C244.325 56.8385 250.014 59.1225 262.574 54.195C253.611 63.4315 252.822 70.0469 254.852 83.012Z" />
        <path d="M275.626 97.3875C278.179 88.2512 277.138 83.7734 270.281 77.4407C280.63 80.423 285.214 78.8959 291.687 71.7049C288.553 80.8937 289.197 85.4019 297.032 91.6517C287.761 89.3164 283.212 91.2658 275.626 97.3875Z" />
      </svg>
    </button>
  );
}
