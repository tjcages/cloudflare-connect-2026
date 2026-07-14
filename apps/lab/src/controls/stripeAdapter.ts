import type { Stripe } from "@necatikcl/stripes-engine";
import { hexToInt, intToHex } from "../lib/color";

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
    hex: intToHex(s.color),
    startFrom: s.startFrom,
    width: s.width,
    opacity: s.opacity,
  }));
}

export function fromEditable(rows: EditableStripe[]): Stripe[] {
  return rows.map((r) => ({
    color: hexToInt(r.hex),
    startFrom: r.startFrom,
    width: r.width,
    opacity: r.opacity,
  }));
}
