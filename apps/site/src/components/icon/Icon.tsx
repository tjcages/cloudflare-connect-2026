import { ICONS } from "virtual:icons";
import cn from "classnames";
import type { CSSProperties } from "react";

import type { IslandProps } from "@/types/island-props";

import type { IconName } from "./icons.gen";

export type IconColor = "red" | "orange" | "green" | "blue" | "purple";

type BaseProps = {
  className?: string;
  size?: number;
  style?: CSSProperties;
};

type MonoProps = BaseProps & {
  name: IconName;
  variant?: "mono";
  color?: never;
};

type DuoProps = BaseProps & {
  // Mono icons ignore --icon-color-* vars and fall back to currentColor, so any icon can be rendered duo.
  name: IconName;
  variant: "duo";
  color?: IconColor | "colorless";
  disabled?: boolean;
};

export type IconProps = IslandProps<MonoProps | DuoProps>;

export default function Icon({ color = "orange", ...props }: IconProps) {
  const { name, size = 20, className } = props;
  const icon = ICONS[name];

  let duoTones: CSSProperties | undefined;
  if (props.variant !== "duo") {
    duoTones = {
      "--icon-color-primary": "currentColor",
      "--icon-color-secondary": "currentColor",
    } as CSSProperties;
  } else if (props.variant === "duo") {
    if (props.disabled) {
      duoTones = {
        "--icon-color-primary": "var(--color-icon-muted)",
        "--icon-color-secondary": "var(--color-icon-subtle)",
      } as CSSProperties;
    } else if (color && color !== "colorless") {
      duoTones = {
        "--icon-color-primary": `var(--color-${color}-900)`,
        "--icon-color-secondary": `var(--color-${color}-800)`,
      } as CSSProperties;
    }
  }

  const style = {
    ...props.style,
    ...duoTones,
  };

  return (
    // fill="none" restores the attribute the normalizer strips; mono paths set their own fill and override it.
    <svg
      aria-hidden
      className={cn("block shrink-0", className)}
      dangerouslySetInnerHTML={{ __html: icon.body }}
      fill="none"
      height={size}
      style={style}
      viewBox={icon.viewBox}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    />
  );
}
