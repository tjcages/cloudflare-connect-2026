import cn from "classnames";
import type { CSSProperties, HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  borderColor?: "default" | "muted";
}

export default function GridArea({
  borderColor = "default",
  className,
  ...rest
}: Props) {
  const generateSvg = (
    size: number
  ) => `<svg width='${size}' height='${size}' viewBox='0 0 ${size} ${size}' fill='none' xmlns='http://www.w3.org/2000/svg'>
    <rect x='0.25' y='0.25' width='${size - 0.5}' height='${size - 0.5}' stroke='#fff' stroke-width='0.5' />
  </svg>`;

  const gridSvgMarkupMobile = generateSvg(32);
  const gridSvgMarkup = generateSvg(80);

  const style = {
    "--background-mobile": `url("data:image/svg+xml,${encodeURIComponent(gridSvgMarkupMobile)}")`,
    "--background": `url("data:image/svg+xml,${encodeURIComponent(gridSvgMarkup)}")`,
    "--grid-line-color": `var(--color-border-${borderColor})`,
  } as CSSProperties;

  return (
    <div
      {...rest}
      className={cn(
        "pointer-events-none absolute text-border-default before:inside-border before:border-current",
        "after:absolute after:inset-0 after:bg-(--grid-line-color) after:responsive-grid-mask",
        className
      )}
      style={style}
    />
  );
}
