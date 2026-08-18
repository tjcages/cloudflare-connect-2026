import type { Stripe } from "@necatikcl/stripes-engine";

export type EditableStripe = {
  id: string;
  hex: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export function toEditable(stripes: Stripe[]): EditableStripe[] {
  return stripes.map((s, index) => ({
    id: String(index),
    hex: `#${s.color.toString(16).padStart(6, "0")}`,
    startFrom: s.startFrom,
    width: s.width,
    opacity: s.opacity,
  }));
}

export function fromEditable(rows: EditableStripe[]): Stripe[] {
  return rows.map((r) => ({
    color: parseInt(r.hex.replace(/^#/, ""), 16) || 0,
    startFrom: r.startFrom,
    width: r.width,
    opacity: r.opacity,
  }));
}
