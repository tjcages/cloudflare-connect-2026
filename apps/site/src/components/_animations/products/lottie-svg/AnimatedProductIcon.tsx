import { useEffect, useRef, useState } from "react";
import type { IconName } from "@/components/icon/icons.gen";
import type { IslandProps } from "@/types/island-props";
import IconAnimation from "./IconAnimation";
import { LOTTIE_SVG_ICONS } from "./lottie-svg.gen";
import type { LottieSvg } from "./types";

const STAGGER_MS = 120;

export type AnimatedProductIconProps = IslandProps<{
  icon: IconName;
  index?: number;
}>;

export default function AnimatedProductIcon({
  icon,
  index = 0,
}: AnimatedProductIconProps) {
  const animation = (LOTTIE_SVG_ICONS as Record<string, LottieSvg | undefined>)[
    icon
  ];
  const rootRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [play, setPlay] = useState(0);

  useEffect(() => {
    const box = rootRef.current?.closest("[data-product-box]");
    if (!box) return;

    const onArrive = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(
        () => setPlay((count) => count + 1),
        index * STAGGER_MS
      );
    };

    box.addEventListener("product-pulse-arrive", onArrive);
    return () => {
      box.removeEventListener("product-pulse-arrive", onArrive);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index]);

  if (!animation) return null;

  return (
    <div
      className="absolute inset-0 flex-center opacity-0 transition-opacity group-data-active:opacity-100"
      ref={rootRef}
    >
      {play > 0 && (
        <IconAnimation animation={animation} className="size-24" key={play} />
      )}
    </div>
  );
}
