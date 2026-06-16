import type { CSSProperties } from "react";
import { HexColorInput } from "react-colorful";
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
  onMove: (id: string, direction: -1 | 1) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
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
  onMove,
  onAdd,
  onRemove,
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
          <th className="stripe-colors-table-label pl-1 text-right" scope="col">
            Order
          </th>
          <th className="stripe-colors-table-label pl-1 text-right" scope="col">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {stripes.map((stripe, index) => (
          <tr key={stripe.id}>
            <td className="py-1 pr-1 align-middle">
              <div className="flex items-center gap-1">
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
                <div className="stripe-colors-leva-input stripe-colors-hex-input">
                  <HexColorInput
                    color={stripe.hex}
                    onChange={(hex) => onColorChange(stripe.id, hex)}
                    prefixed
                    disabled={disabled}
                    aria-label={`Stripe ${index + 1} hex`}
                  />
                </div>
              </div>
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
            <td className="py-1 pl-1 text-right align-middle">
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`Move stripe ${index + 1} up`}
                  onClick={() => onMove(stripe.id, -1)}
                  className="h-5 w-5 rounded border border-builder-hairline text-[10px] leading-none text-builder-control disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === stripes.length - 1}
                  aria-label={`Move stripe ${index + 1} down`}
                  onClick={() => onMove(stripe.id, 1)}
                  className="h-5 w-5 rounded border border-builder-hairline text-[10px] leading-none text-builder-control disabled:opacity-40"
                >
                  ↓
                </button>
              </div>
            </td>
            <td className="py-1 pl-1 text-right align-middle">
              <button
                type="button"
                disabled={disabled || stripes.length <= 1}
                aria-label={`Remove stripe ${index + 1}`}
                onClick={() => onRemove(stripe.id)}
                className="h-5 w-5 rounded border border-builder-hairline text-[10px] leading-none text-builder-control disabled:opacity-40"
              >
                -
              </button>
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} />
          <td className="py-1 pl-1 text-right align-middle">
            <button
              type="button"
              disabled={disabled}
              aria-label="Add stripe"
              onClick={onAdd}
              className="h-5 w-5 rounded border border-builder-hairline text-[10px] leading-none text-builder-control disabled:opacity-40"
            >
              +
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
