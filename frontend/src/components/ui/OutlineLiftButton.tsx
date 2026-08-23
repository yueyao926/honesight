import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./OutlineLiftButton.css";

type OutlineLiftButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "outline" | "solid" | "ghost";
  size?: "md" | "sm";
};

export default function OutlineLiftButton({
  children,
  variant = "outline",
  size = "md",
  className = "",
  type = "button",
  ...props
}: OutlineLiftButtonProps) {
  const classes = [
    "outline-lift-button",
    variant === "solid" ? "outline-lift-button--solid" : "",
    variant === "ghost" ? "outline-lift-button--ghost" : "",
    size === "sm" ? "outline-lift-button--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
