import { getIconDefinition } from "../lib/iconRegistry";
import type { IconId } from "../grid/types";

type ComponentIconProps = {
  iconId: IconId;
  color: string;
  size?: number;
  title?: string;
  className?: string;
};

export const ComponentIcon = ({
  iconId,
  color,
  size = 24,
  title,
  className = "component-icon",
}: ComponentIconProps) => {
  const icon = getIconDefinition(iconId);
  const titleId = title ? `${icon.id}-title` : undefined;

  const strokeW = icon.strokeWidth ?? 1.25;

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
      {icon.renderMode === "stroke"
        ? icon.paths.map((d, i) => (
            <path key={`${icon.id}-${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={strokeW} />
          ))
        : icon.paths.map((d, i) => <path key={`${icon.id}-${i}`} d={d} fill={color} />)}
    </svg>
  );
};
