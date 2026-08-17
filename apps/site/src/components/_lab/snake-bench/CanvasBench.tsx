import { useEffect, useRef } from "react";
import { createCanvasPainter } from "@/components/_animations/shared/snake-pulse/canvas-snake";
import { benchLayouts, benchStats, createDriver } from "./bench";

export default function CanvasBench({
  count,
  bent,
}: {
  count: number;
  bent: boolean;
}) {
  "use no memo";

  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    const painter = createCanvasPainter(layer);
    const entries = benchLayouts(count, bent).map((layout) => ({
      snake: painter.makeSnake(layout, "orange", "orange", {
        taper: false,
        emergeMask: false,
      }),
      layout,
    }));

    const drive = createDriver(entries);
    let frame = 0;
    let last = 0;
    let elapsed = 0;

    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const started = performance.now();
      elapsed += last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      drive(elapsed);
      painter.paint();
      const ended = performance.now();
      benchStats.frame(ended, ended - started);
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      painter.destroy();
    };
  }, [count, bent]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      ref={layerRef}
    />
  );
}
