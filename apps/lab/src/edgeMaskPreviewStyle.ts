import type { EdgeMaskConfig } from "@necatikcl/stripes-engine";
import type { CSSProperties } from "react";

const RAMP_STEPS = 32;

function format(value: number): string {
  return String(Number(value.toFixed(5)));
}

function gradient(direction: "right" | "left" | "bottom" | "top", config: EdgeMaskConfig): string {
  const stops: string[] = ["rgb(0 0 0 / 0) 0%"];
  const samples = new Set<number>();
  for (let index = 0; index <= RAMP_STEPS; index++) {
    const sample = index / RAMP_STEPS;
    samples.add(sample);
    samples.add(sample ** (1 / config.power));
  }
  const progressSamples = [...samples].sort((a, b) => a - b);
  for (const progress of progressSamples) {
    const position = config.start + (config.end - config.start) * progress;
    stops.push(`rgb(0 0 0 / ${format(progress ** config.power)}) ${format(position * 100)}%`);
  }
  stops.push("rgb(0 0 0) 100%");
  return `linear-gradient(to ${direction}, ${stops.join(", ")})`;
}

export function edgeMaskPreviewStyle(config: EdgeMaskConfig): CSSProperties | undefined {
  if (!config.enabled) return undefined;

  const gradients = [
    config.sides.left ? gradient("right", config) : null,
    config.sides.right ? gradient("left", config) : null,
    config.sides.top ? gradient("bottom", config) : null,
    config.sides.bottom ? gradient("top", config) : null,
  ].filter((value): value is string => value !== null);

  if (gradients.length === 0) return undefined;

  return {
    maskImage: gradients.join(", "),
    maskMode: "alpha",
    maskComposite: "intersect",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "100% 100%",
  };
}
