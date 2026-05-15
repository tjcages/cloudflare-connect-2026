import { getIconDefinition } from "../lib/iconRegistry";
import type { IconId } from "../grid/types";

type ComponentIconProps = {
  iconId: IconId;
  color: string;
  size?: number;
  className?: string;
};

export const ComponentIcon = ({ iconId, color, size = 24, className = "component-icon" }: ComponentIconProps) => {
  const icon = getIconDefinition(iconId);

  const strokeW = icon.strokeWidth ?? 1.25;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color }}
    >
      {icon.renderMode === "stroke"
        ? icon.paths.map((d, i) => (
            <path
              key={`${icon.id}-${i}`}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeW}
              strokeLinecap={icon.strokeLinecap}
              strokeLinejoin={icon.strokeLinejoin}
            />
          ))
        : icon.paths.map((d, i) => <path key={`${icon.id}-${i}`} d={d} fill={color} />)}
    </svg>
  );
};
