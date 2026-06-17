import type { CSSProperties } from "react";
import { HexColorPopover } from "../components/HexColorPopover";
import { PLAYGROUND_LEVA_COLOR_SWATCH_CLASS } from "./playgroundUi";
import {
  clampStripeStartFrom,
  clampStripeWidth,
  STRIPE_START_FROM_MAX,
  STRIPE_START_FROM_MIN,
  STRIPE_WIDTH_MIN,
  STRIPE_WIDTH_STORAGE_MAX,
  type Stripe,
} from "./stripeColors";
import { cn } from "../lib/cn";

export type StripeColorsTableProps = {
  stripes: readonly Stripe[];
  disabled?: boolean;
  onColorChange: (id: string, hex: string) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
};

function parseThresholdInput(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  return clampStripeStartFrom(value);
}

function parseWidthInput(raw: string): number | null {
  if (raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  return clampStripeWidth(value);
}

export function StripeColorsTable({
  stripes,
  disabled = false,
  onColorChange,
  onThresholdChange,
  onWidthChange,
}: StripeColorsTableProps) {
  return (
    <table
      className={cn(
        "stripe-colors-table w-full border-collapse text-[11px]",
        disabled && "pointer-events-none opacity-45",
      )}
    >
      <thead>
        <tr>
          <th className="stripe-colors-table-label pr-1 text-left" scope="col">
            Color
          </th>
          <th className="stripe-colors-table-label pr-1 text-right" scope="col">
            Threshold
          </th>
          <th className="stripe-colors-table-label text-right" scope="col">
            Width
          </th>
        </tr>
      </thead>
      <tbody>
        {stripes.map((stripe, index) => (
          <tr key={stripe.id}>
            <td className="py-1 pr-1 align-middle">
              <HexColorPopover
                color={stripe.hex}
                onChange={(hex) => onColorChange(stripe.id, hex)}
                disabled={disabled}
                ariaLabel={`Stripe ${index + 1} color`}
                triggerClassName={PLAYGROUND_LEVA_COLOR_SWATCH_CLASS}
                triggerStyle={
                  {
                    backgroundColor: stripe.hex,
                    "--stripe-swatch-color": stripe.hex,
                  } as CSSProperties
                }
                align="right"
              />
            </td>
            <td className="py-1 pr-1 text-right align-middle">
              <div className="stripe-colors-leva-input">
                <input
                  type="number"
                  min={STRIPE_START_FROM_MIN}
                  max={STRIPE_START_FROM_MAX}
                  step={0.01}
                  value={stripe.startFrom}
                  disabled={disabled}
                  aria-label={`Stripe ${index + 1} threshold`}
                  onChange={(event) => {
                    const next = parseThresholdInput(event.target.value);
                    if (next !== null) {
                      onThresholdChange(stripe.id, next);
                    }
                  }}
                />
              </div>
            </td>
            <td className="py-1 text-right align-middle">
              <div className="stripe-colors-leva-input">
                <input
                  type="number"
                  min={STRIPE_WIDTH_MIN}
                  max={STRIPE_WIDTH_STORAGE_MAX}
                  step={1}
                  value={stripe.width}
                  disabled={disabled}
                  aria-label={`Stripe ${index + 1} width`}
                  onChange={(event) => {
                    const next = parseWidthInput(event.target.value);
                    if (next !== null) {
                      onWidthChange(stripe.id, next);
                    }
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
