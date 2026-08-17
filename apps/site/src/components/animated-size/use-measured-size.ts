import { useEffect, useRef, useState } from "react";

interface MeasuredSize {
  height: number | "auto";
  width: number | "auto";
}

export function useMeasuredSize(measureImmediately = false) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState<MeasuredSize>({
    height: "auto",
    width: "auto",
  });

  useEffect(() => {
    const child = containerRef.current?.children[0] ?? null;
    if (!child) return;

    const updateSize = () => {
      if (!child) return;

      setSize({ height: child.clientHeight, width: child.clientWidth });
    };

    if (measureImmediately) updateSize();

    const resizeObserver = new ResizeObserver(updateSize);

    resizeObserver.observe(child);

    return () => resizeObserver.disconnect();
  }, []);

  return { containerRef, size };
}
