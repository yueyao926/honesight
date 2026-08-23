import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./ClayPressButton.css";

type ClayPressButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  active?: boolean;
  size?: "md" | "sm";
};

export default function ClayPressButton({
  children,
  active = false,
  size = "md",
  className = "",
  type = "button",
  ...props
}: ClayPressButtonProps) {
  const sizeClass = size === "sm" ? " clay-press-btn--sm" : "";

  return (
    <button
      type={type}
      className={`clay-press-btn${sizeClass}${active ? " clay-press-btn--active" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    >
      <span className="clay-press-btn__back" aria-hidden="true" />
      <span className="clay-press-btn__front">{children}</span>
    </button>
  );
}
