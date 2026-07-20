import type { EngineConfig, Stripe } from "../config/types";

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(1e-5, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function applyImageColorDensity(stripes: Stripe[], removeThin: number, boostThick: number): Stripe[] {
  const cutoff = clamp01(removeThin);
  const boost = Math.max(0, boostThick);
  if (cutoff <= 0 && boost <= 0) return stripes;
  const filtered = stripes.filter((stripe) => stripe.startFrom >= cutoff);
  const source = filtered.length > 0 ? filtered : stripes.slice(-1);

  return source.map((stripe) => {
    const highBandWeight = smoothstep(0.45, 1, stripe.startFrom);
    const expandedStart = Math.max(cutoff, stripe.startFrom - highBandWeight * boost * 0.12);
    const boostedWidth = Math.round(stripe.width * (1 + highBandWeight * boost));
    return {
      ...stripe,
      startFrom: expandedStart,
      width: Math.max(1, Math.min(64, boostedWidth)),
    };
  });
}

export function effectiveStripes(config: EngineConfig): Stripe[] {
  if (config.colors.mode !== "colors") return config.stripes;
  return applyImageColorDensity(config.stripes, config.colors.imageColorRemoveThin, config.colors.imageColorBoostThick);
}
