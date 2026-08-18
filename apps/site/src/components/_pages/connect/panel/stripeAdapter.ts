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

/** Hex-string stripe row shape shared by the speaker-frame and agenda-rain
 *  settings records (`SpeakerStripeControl` / `AgendaRainStripeControl`). */
export type StripeControl = {
  id: string;
  color: string;
  startFrom: number;
  width: number;
  opacity: number;
};

export function toEditableControls(stripes: StripeControl[]): EditableStripe[] {
  return stripes.map((stripe) => ({
    id: stripe.id,
    hex: stripe.color,
    startFrom: stripe.startFrom,
    width: stripe.width,
    opacity: stripe.opacity,
  }));
}

export function fromEditableControls(rows: EditableStripe[]): StripeControl[] {
  return rows.map((row) => ({
    id: row.id,
    color: row.hex,
    startFrom: row.startFrom,
    width: row.width,
    opacity: row.opacity,
  }));
}
