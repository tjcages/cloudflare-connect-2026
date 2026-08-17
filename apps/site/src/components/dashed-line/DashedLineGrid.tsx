import cn from "classnames";
import { useLayoutEffect, useRef, useState } from "react";
import DashedLattice from "./DashedLattice";

export default function DashedLineGrid({
  rows,
  columns,
  color = "var(--color-border-dashed)",
}: {
  rows: number;
  columns: number;
  color?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) {
        setSize({ w: width, h: height });
      }
    });
    observer.observe(svg);

    return () => observer.disconnect();
  }, []);

  const crossXs = size
    ? Array.from({ length: columns - 1 }, (_, i) =>
        Math.round((size.w * (i + 1)) / columns)
      )
    : [];
  const crossYs = size
    ? Array.from({ length: rows - 1 }, (_, i) =>
        Math.round((size.h * (i + 1)) / rows)
      )
    : [];

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full transition-opacity duration-450",
        size ? "opacity-100" : "opacity-0"
      )}
      ref={ref}
      shapeRendering="crispEdges"
      style={{ color }}
    >
      {size && (
        <DashedLattice h={size.h} w={size.w} xs={crossXs} ys={crossYs} />
      )}
    </svg>
  );
}
