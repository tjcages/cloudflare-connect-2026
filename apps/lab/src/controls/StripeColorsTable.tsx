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
  onRemove,
}: {
  stripe: EditableStripe;
  index: number;
  disabled: boolean;
  onColorChange: (id: string, hex: string) => void;
  onRemove: (id: string) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={stripe}
      dragListener={false}
      dragControls={controls}
      className="stripe-colors-color-row flex items-center gap-1"
    >
      <button
        type="button"
        aria-label={`Reorder Stripe ${index + 1} color`}
        className="stripe-colors-grip cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-600"
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
        triggerClassName="size-6 shrink-0 rounded border border-[#d6d6d6] p-0"
        triggerStyle={
          {
            backgroundColor: stripe.hex,
          } as CSSProperties
        }
        align="right"
      />
      <button
        type="button"
        aria-label={`Remove Stripe ${index + 1}`}
        className="ml-auto cursor-pointer text-neutral-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled}
        onClick={() => onRemove(stripe.id)}
      >
        <X size={12} />
      </button>
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

  useEffect(() => {
    setOrder([...stripes]);
  }, [stripes]);

  return (
    <div className={cn("stripe-colors-table text-[11px]", disabled && "pointer-events-none opacity-45")}>
      <div className="flex gap-1 mb-1">
        <div className="flex-1 text-right pr-1 text-neutral-400 font-medium">Color</div>
        <div className="flex-1 flex gap-1">
          <span className="flex-1 text-right text-neutral-400 font-medium">Threshold</span>
          <span className="flex-1 text-right text-neutral-400 font-medium">Width</span>
        </div>
      </div>
      <div className="flex gap-1">
        <Reorder.Group
          as="div"
          axis="y"
          values={order}
          onReorder={(next) => {
            setOrder(next);
            onColorReorder(next.map((s) => s.id));
          }}
          className="flex flex-col gap-0.5 w-[72px] shrink-0"
        >
          {order.map((stripe, index) => (
            <StripeColorRow
              key={stripe.id}
              stripe={stripe}
              index={index}
              disabled={disabled}
              onColorChange={onColorChange}
              onRemove={onRemove}
            />
          ))}
        </Reorder.Group>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {stripes.map((stripe, index) => (
            <div key={stripe.id} className="flex gap-1 h-6 items-center">
              <input
                type="number"
                min={STRIPE_START_FROM_MIN}
                max={STRIPE_START_FROM_MAX}
                step={0.01}
                value={stripe.startFrom}
                disabled={disabled}
                aria-label={`Stripe ${index + 1} threshold`}
                className="w-full min-w-0 rounded border border-[#d6d6d6] bg-white px-1 py-0 text-[11px] tabular-nums"
                onChange={(event) => {
                  const next = parseThresholdInput(event.target.value);
                  if (next !== null) {
                    onThresholdChange(stripe.id, next);
                  }
                }}
              />
              <input
                type="number"
                min={STRIPE_WIDTH_MIN}
                max={STRIPE_WIDTH_MAX}
                step={1}
                value={stripe.width}
                disabled={disabled}
                aria-label={`Stripe ${index + 1} width`}
                className="w-full min-w-0 rounded border border-[#d6d6d6] bg-white px-1 py-0 text-[11px] tabular-nums"
                onChange={(event) => {
                  const next = parseWidthInput(event.target.value);
                  if (next !== null) {
                    onWidthChange(stripe.id, next);
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-dashed border-[#d6d6d6] px-2 py-1 text-[11px] text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Plus size={11} />
        Add stripe
      </button>
    </div>
  );
}
