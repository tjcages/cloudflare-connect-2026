import cn from "classnames";
import { useLayoutEffect, useRef, useState } from "react";
import DashedLattice from "@/components/dashed-line/DashedLattice";
import { resolveZoom } from "@/utils/zoom";

type Lattice = { w: number; h: number; xs: number[]; ys: number[] };

export default function PricingLattice() {
  const ref = useRef<SVGSVGElement>(null);
  const [lattice, setLattice] = useState<Lattice | null>(null);

  useLayoutEffect(() => {
    const svg = ref.current;
    const table = svg?.closest("div")?.querySelector("table");
    if (!svg || !table) {
      return;
    }

    const observer = new ResizeObserver(() => {
      const zoom = resolveZoom(svg);
      const box = svg.getBoundingClientRect();
      if (!(box.width && box.height)) {
        return;
      }

      const rows = [...table.querySelectorAll("tr")];
      const ys = rows
        .slice(0, -1)
        .map((row) =>
          Math.round((row.getBoundingClientRect().bottom - box.top) / zoom)
        );
      const xs = [...(rows[0]?.children ?? [])]
        .slice(0, -1)
        .map((cell) =>
          Math.round((cell.getBoundingClientRect().right - box.left) / zoom)
        );

      setLattice({ w: box.width / zoom, h: box.height / zoom, xs, ys });
    });
    observer.observe(table);

    return () => observer.disconnect();
  }, []);

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full text-border-dashed transition-opacity duration-450",
        lattice ? "opacity-100" : "opacity-0"
      )}
      ref={ref}
      shapeRendering="crispEdges"
    >
      {lattice && (
        <DashedLattice
          h={lattice.h}
          w={lattice.w}
          xs={lattice.xs}
          ys={lattice.ys}
        />
      )}
    </svg>
  );
}
