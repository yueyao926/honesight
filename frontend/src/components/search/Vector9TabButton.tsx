import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Vector9TabButton.css";

type Vector9TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export default function Vector9TabButton({
  active = false,
  children,
  className = "",
  type = "button",
  ...props
}: Vector9TabButtonProps) {
  const classes = [
    "search-outline-tab",
    active ? "search-outline-tab--active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} aria-pressed={active} {...props}>
      {children}
    </button>
  );
}
