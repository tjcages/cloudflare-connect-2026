import type { Stripe } from "../config/types";

export function bandIndexForValue(value01: number, stripes: Stripe[]): number {
  if (stripes.length === 0) return 0;
  const sorted = [...stripes].sort((a, b) => a.startFrom - b.startFrom);
  let band = -1;
  for (let i = 0; i < sorted.length; i++) if (sorted[i].startFrom <= value01) band = i;
  return band + 1;
}
