import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical, X, Plus } from "lucide-react";
import { HexColorPopover } from "../components/HexColorPopover";
import { cn } from "../lib/cn";
import type { EditableStripe } from "./stripeAdapter";

const STRIPE_START_FROM_MIN = 0;
const STRIPE_START_FROM_MAX = 1;
const STRIPE_WIDTH_MIN = 1;
const STRIPE_WIDTH_MAX = 64;

function clampStartFrom(v: number): number {
  return v < STRIPE_START_FROM_MIN ? STRIPE_START_FROM_MIN : v > STRIPE_START_FROM_MAX ? STRIPE_START_FROM_MAX : v;
}

function clampWidth(v: number): number {
  const r = Math.round(v);
  return r < STRIPE_WIDTH_MIN ? STRIPE_WIDTH_MIN : r > STRIPE_WIDTH_MAX ? STRIPE_WIDTH_MAX : r;
}

function parseThresholdInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return clampStartFrom(value);
}

function parseWidthInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return clampWidth(value);
}

export type StripeColorsTableProps = {
  stripes: readonly EditableStripe[];
  disabled?: boolean;
  onColorChange: (id: string, hex: string) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onColorReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

function StripeColorRow({
  stripe,
  index,
  disabled,
  onColorChange,
}: {
  stripe: EditableStripe;
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
        className="stripe-colors-grip"
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
        triggerClassName="stripe-colors-leva-swatch"
        triggerStyle={{ "--stripe-swatch-color": stripe.hex } as CSSProperties}
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
  onAdd,
  onRemove,
}: StripeColorsTableProps) {
  const [order, setOrder] = useState<EditableStripe[]>(() => [...stripes]);
  const reconcileKey = stripes.map((s) => `${s.id}:${s.hex}`).join("|");

  useEffect(() => {
    setOrder([...stripes]);
  }, [reconcileKey]);

  return (
    <div className={cn("stripe-colors-table", disabled && "pointer-events-none opacity-45")}>
      <div className="stripe-colors-header">
        <div className="stripe-colors-header-color">
          <span className="stripe-colors-table-label">Color</span>
        </div>
        <div className="stripe-colors-header-ladder">
          <span className="stripe-colors-table-label">Threshold</span>
          <span className="stripe-colors-table-label">Width</span>
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
            <div key={stripe.id} className="stripe-colors-ladder-row">
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
                    if (next !== null) onThresholdChange(stripe.id, next);
                  }}
                />
              </div>
              <div className="stripe-colors-leva-input">
                <input
                  type="number"
                  min={STRIPE_WIDTH_MIN}
                  max={STRIPE_WIDTH_MAX}
                  step={1}
                  value={stripe.width}
                  disabled={disabled}
                  aria-label={`Stripe ${index + 1} width`}
                  onChange={(event) => {
                    const next = parseWidthInput(event.target.value);
                    if (next !== null) onWidthChange(stripe.id, next);
                  }}
                />
              </div>
              <button
                type="button"
                aria-label={`Remove Stripe ${index + 1}`}
                className="stripe-colors-remove"
                disabled={disabled}
                onClick={() => onRemove(stripe.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="stripe-colors-add" disabled={disabled} onClick={onAdd}>
        <Plus size={11} />
        Add stripe
      </button>
    </div>
  );
}
