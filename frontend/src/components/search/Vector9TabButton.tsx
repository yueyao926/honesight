import type { ButtonHTMLAttributes, ReactNode } from "react";
import vector9Svg from "../../SVG/Vector (9).svg?url";

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
  return (
    <button
      type={type}
      className={`vector9-tab-btn${active ? " vector9-tab-btn--active" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    >
      <img src={vector9Svg} alt="" draggable={false} className="vector9-tab-btn__frame" aria-hidden="true" />
      <span className="vector9-tab-btn__label">{children}</span>
    </button>
  );
}
