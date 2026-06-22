import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical } from "lucide-react";
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
} from "@necatikcl/stripes-shader";
import { cn } from "../lib/cn";

export type StripeColorsTableProps = {
  stripes: readonly Stripe[];
  disabled?: boolean;
  onColorChange: (id: string, hex: string) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onColorReorder: (orderedIds: string[]) => void;
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

function StripeColorRow({
  stripe,
  index,
  disabled,
  onColorChange,
}: {
  stripe: Stripe;
  index: number;
  disabled: boolean;
  onColorChange: (id: string, hex: string) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={stripe}
      dragListener={false}
      dragControls={controls}
      className="stripe-colors-color-row"
    >
      <button
        type="button"
        aria-label={`Reorder Stripe ${index + 1} color`}
        className="stripe-colors-grip cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        disabled={disabled}
        onPointerDown={disabled ? undefined : (event) => controls.start(event)}
      >
        <GripVertical size={14} />
      </button>
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
    </Reorder.Item>
  );
}

export function StripeColorsTable({
  stripes,
  disabled = false,
  onColorChange,
  onThresholdChange,
  onWidthChange,
  onColorReorder,
}: StripeColorsTableProps) {
  const [order, setOrder] = useState<Stripe[]>(() => [...stripes]);
  const reconcileKey = stripes.map((s) => `${s.id}:${s.hex}`).join("|");

  useEffect(() => {
    setOrder([...stripes]);
  }, [reconcileKey]);

  return (
    <div className={cn("stripe-colors-table text-[11px]", disabled && "pointer-events-none opacity-45")}>
      <div className="stripe-colors-header">
        <div className="stripe-colors-header-color">
          <span className="stripe-colors-table-label text-left">Color</span>
        </div>
        <div className="stripe-colors-header-ladder">
          <span className="stripe-colors-table-label text-right">Threshold</span>
          <span className="stripe-colors-table-label text-right">Width</span>
        </div>
      </div>
      <div className="stripe-colors-body">
        <Reorder.Group
          as="div"
          axis="y"
          values={order}
          onReorder={(next) => {
            setOrder(next);
            onColorReorder(next.map((s) => s.id));
          }}
          className="stripe-colors-color-column"
        >
          {order.map((stripe, index) => (
            <StripeColorRow
              key={stripe.id}
              stripe={stripe}
              index={index}
              disabled={disabled}
              onColorChange={onColorChange}
            />
          ))}
        </Reorder.Group>
        <div className="stripe-colors-ladder-column">
          {stripes.map((stripe, index) => (
            <div key={index} className="stripe-colors-ladder-row">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
