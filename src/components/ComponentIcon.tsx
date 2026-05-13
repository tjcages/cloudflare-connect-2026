import { getIconDefinition } from "./iconRegistry";
import type { IconId } from "../grid/types";

type ComponentIconProps = {
  iconId: IconId;
  color: string;
  size?: number;
  title?: string;
  className?: string;
};

export const ComponentIcon = ({ iconId, color, size = 24, title, className = "component-icon" }: ComponentIconProps) => {
  const icon = getIconDefinition(iconId);
  const titleId = title ? `${icon.id}-title` : undefined;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-labelledby={titleId}
      aria-hidden={title ? undefined : true}
      style={{ color }}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {icon.paths.map((path) => (
        <path key={path} d={path} fill={color} />
      ))}
    </svg>
  );
};
