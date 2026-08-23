import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./PillShiftButton.css";

type PillShiftButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function PillShiftButton({
  children,
  className = "",
  type = "button",
  ...props
}: PillShiftButtonProps) {
  const classes = ["pill-shift-button", className].filter(Boolean).join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
