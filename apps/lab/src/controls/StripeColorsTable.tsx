import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { ChevronDown, ChevronRight, GripVertical, X, Plus } from "lucide-react";
import { range as levaRange } from "leva/plugin";
import { HexColorPopover } from "../components/HexColorPopover";
import { COLOR_LIBRARY, cssColorForHex } from "../components/colorLibrary";
import { cn } from "../lib/cn";
import { loadControlDrawerOpen, saveControlDrawerOpen } from "./drawerState";
import { DEFAULT_CUSTOM_EASING, easeValue, formatCustomEasing, parseCustomEasing } from "./easing";
import type { EditableStripe } from "./stripeAdapter";

const STRIPE_START_FROM_MIN = 0;
const STRIPE_START_FROM_MAX = 1;
const STRIPE_WIDTH_MIN = 0.5;
const STRIPE_WIDTH_MAX = 64;
const STRIPE_OPACITY_MIN = 0;
const STRIPE_OPACITY_MAX = 100;

function clampStartFrom(v: number): number {
  return v < STRIPE_START_FROM_MIN ? STRIPE_START_FROM_MIN : v > STRIPE_START_FROM_MAX ? STRIPE_START_FROM_MAX : v;
}

function clampWidth(v: number): number {
  return v < STRIPE_WIDTH_MIN ? STRIPE_WIDTH_MIN : v > STRIPE_WIDTH_MAX ? STRIPE_WIDTH_MAX : v;
}

function clampOpacityPercent(v: number): number {
  return v < STRIPE_OPACITY_MIN ? STRIPE_OPACITY_MIN : v > STRIPE_OPACITY_MAX ? STRIPE_OPACITY_MAX : v;
}

function parseNumberLike(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function parseThresholdInput(raw: string): number | null {
  const value = parseNumberLike(raw);
  if (value === null) return null;
  return clampStartFrom(value);
}

function parseWidthInput(raw: string): number | null {
  const value = parseNumberLike(raw);
  if (value === null) return null;
  return clampWidth(value);
}

function parseOpacityInput(raw: string): number | null {
  const value = parseNumberLike(raw);
  if (value === null) return null;
  return Math.round(clampOpacityPercent(value));
}

function isIncompleteDecimal(raw: string): boolean {
  return /[,.]$/.test(raw.trim());
}

function formatWidth(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value)
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, "");
}

function formatThreshold(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatOpacityPercent(value: number): string {
  return String(Math.round(clampOpacityPercent(value)));
}

function normalizeHexForDisplay(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : value;
}

function getStripeColorMeta(hex: string): { name: string; code: string } {
  const normalized = normalizeHexForDisplay(hex).toLowerCase();
  for (const group of COLOR_LIBRARY) {
    const match = group.colors.find((color) => color.hex.toLowerCase() === normalized);
    if (match) {
      return {
        name: `${group.name} ${match.label}`,
        code: normalizeHexForDisplay(match.hex),
      };
    }
  }
  return { name: "Custom", code: normalizeHexForDisplay(hex) };
}

function sanitizeLevaStep(v: number, { step, initialValue }: { step: number; initialValue: number }): number {
  const steps = Math.round((v - initialValue) / step);
  return initialValue + steps * step;
}

function clampRangeValue(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export type StripeColorsTableProps = {
  stripes: readonly EditableStripe[];
  disabled?: boolean;
  paletteOptions?: readonly string[];
  paletteValue?: string;
  rampEasingOptions?: Readonly<Record<string, string>>;
  rampEasingValue?: string;
  showRampEasing?: boolean;
  thresholdEasingOptions?: Readonly<Record<string, string>>;
  thresholdEasingValue?: string;
  canUndoShuffle?: boolean;
  onPaletteChange?: (palette: string) => void;
  onRampEasingChange?: (easing: string) => void;
  onThresholdEasingChange?: (easing: string) => void;
  onShufflePalette?: () => void;
  onUndoShuffle?: () => void;
  onReverseColorOrder?: () => void;
  onColorChange: (id: string, hex: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onColorReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

function LevaRangeSlider({
  value,
  min,
  max,
  step,
  initialValue,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  initialValue: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);

  function updateValue(nextValue: number) {
    onChange(clampRangeValue(sanitizeLevaStep(nextValue, { step, initialValue }), min, max));
  }

  function updateFromClientX(clientX: number) {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0) return;
    const percent = (clientX - bounds.left) / bounds.width;
    updateValue(min + clampRangeValue(percent, 0, 1) * (max - min));
  }

  const pos = levaRange(value, min, max);

  return (
    <div
      ref={ref}
      className="stripe-colors-range-root"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        pointerId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (disabled || pointerId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        updateFromClientX(event.clientX);
      }}
      onPointerUp={(event) => {
        if (pointerId.current !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        pointerId.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (pointerId.current !== event.pointerId) return;
        pointerId.current = null;
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          updateValue(value - step);
        }
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          updateValue(value + step);
        }
        if (event.key === "Home") {
          event.preventDefault();
          updateValue(min);
        }
        if (event.key === "End") {
          event.preventDefault();
          updateValue(max);
        }
      }}
    >
      <div className="stripe-colors-range-track">
        <div className="stripe-colors-range-fill" style={{ right: `${(1 - pos) * 100}%` }} />
      </div>
      <div className="stripe-colors-range-thumb" style={{ left: `calc(${pos} * (100% - 8px))` }} />
    </div>
  );
}

function StripeNumberInput({
  value,
  formatValue,
  parseValue,
  onValueChange,
  ariaLabel,
  disabled,
}: {
  value: number;
  formatValue: (value: number) => string;
  parseValue: (raw: string) => number | null;
  onValueChange: (value: number) => void;
  ariaLabel: string;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(() => formatValue(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatValue(value));
  }, [focused, formatValue, value]);

  function commit(raw: string) {
    const next = parseValue(raw);
    if (next === null) {
      setDraft(formatValue(value));
      return;
    }
    onValueChange(next);
    setDraft(formatValue(next));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const next = parseValue(raw);
        if (next !== null && !isIncompleteDecimal(raw)) onValueChange(next);
      }}
      onBlur={() => {
        setFocused(false);
        commit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function StripeControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="stripe-colors-control-row">
      <span className="stripe-colors-table-label">{label}</span>
      {children}
    </div>
  );
}

function EasingGraph({
  value,
  disabled = false,
  onChange,
}: {
  value: string | undefined;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  const width = 168;
  const height = 88;
  const pad = 10;
  const ref = useRef<SVGSVGElement | null>(null);
  const activeHandle = useRef<"p1" | "p2" | null>(null);
  const custom = parseCustomEasing(value);
  const pointX = (x: number) => pad + x * (width - pad * 2);
  const pointY = (y: number) => height - pad - y * (height - pad * 2);
  const graphX = (x: number) => clampRangeValue((x - pad) / (width - pad * 2), 0, 1);
  const graphY = (y: number) => clampRangeValue((height - pad - y) / (height - pad * 2), 0, 1);
  const editablePoints = custom ?? DEFAULT_CUSTOM_EASING;

  function updateHandle(handle: "p1" | "p2", clientX: number, clientY: number) {
    if (!onChange || disabled) return;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const svgX = ((clientX - bounds.left) / bounds.width) * width;
    const svgY = ((clientY - bounds.top) / bounds.height) * height;
    const next =
      handle === "p1"
        ? { ...editablePoints, x1: graphX(svgX), y1: graphY(svgY) }
        : { ...editablePoints, x2: graphX(svgX), y2: graphY(svgY) };
    onChange(formatCustomEasing(next));
  }

  function nearestHandle(clientX: number, clientY: number): "p1" | "p2" {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return "p1";
    const svgX = ((clientX - bounds.left) / bounds.width) * width;
    const svgY = ((clientY - bounds.top) / bounds.height) * height;
    const p1x = pointX(editablePoints.x1);
    const p1y = pointY(editablePoints.y1);
    const p2x = pointX(editablePoints.x2);
    const p2y = pointY(editablePoints.y2);
    const d1 = Math.hypot(svgX - p1x, svgY - p1y);
    const d2 = Math.hypot(svgX - p2x, svgY - p2y);
    return d1 <= d2 ? "p1" : "p2";
  }

  const points = Array.from({ length: 40 }, (_, index) => {
    const t = index / 39;
    const x = pointX(t);
    const y = pointY(easeValue(t, value || "linear"));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg
      ref={ref}
      className={cn("stripe-colors-easing-graph", onChange && !disabled ? "is-editable" : null)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      onPointerDown={(event) => {
        if (!onChange || disabled) return;
        event.preventDefault();
        event.stopPropagation();
        const handle = nearestHandle(event.clientX, event.clientY);
        activeHandle.current = handle;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateHandle(handle, event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (!onChange || disabled || !activeHandle.current) return;
        event.preventDefault();
        event.stopPropagation();
        updateHandle(activeHandle.current, event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (!activeHandle.current) return;
        event.preventDefault();
        event.stopPropagation();
        activeHandle.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        activeHandle.current = null;
      }}
    >
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
      {custom || onChange ? (
        <>
          <line
            className="stripe-colors-easing-handle-line"
            x1={pad}
            y1={height - pad}
            x2={pointX(editablePoints.x1)}
            y2={pointY(editablePoints.y1)}
          />
          <line
            className="stripe-colors-easing-handle-line"
            x1={width - pad}
            y1={pad}
            x2={pointX(editablePoints.x2)}
            y2={pointY(editablePoints.y2)}
          />
        </>
      ) : null}
      <polyline points={points} />
      {custom || onChange ? (
        <>
          <circle
            className="stripe-colors-easing-handle"
            cx={pointX(editablePoints.x1)}
            cy={pointY(editablePoints.y1)}
            r="4.2"
          />
          <circle
            className="stripe-colors-easing-handle"
            cx={pointX(editablePoints.x2)}
            cy={pointY(editablePoints.y2)}
            r="4.2"
          />
        </>
      ) : null}
    </svg>
  );
}

function EasingControl({
  label,
  value,
  options,
  disabled,
  ariaLabel,
  onChange,
}: {
  label: string;
  value?: string;
  options: Readonly<Record<string, string>>;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const customValue = value?.startsWith("custom:") ? value : formatCustomEasing(DEFAULT_CUSTOM_EASING);
  const selectValue = value?.startsWith("custom:") ? "__custom" : (value ?? "");

  return (
    <div className="stripe-colors-easing-row">
      <span className="stripe-colors-table-label">{label}</span>
      <div className="stripe-colors-easing-control">
        <select
          value={selectValue}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value === "__custom" ? customValue : event.target.value)}
        >
          {Object.entries(options).map(([optionLabel, optionValue]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
          <option value="__custom">Custom</option>
        </select>
        <EasingGraph value={value} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  );
}

function StripeDetailRow({
  stripe,
  index,
  disabled,
  onColorChange,
  onOpacityChange,
  onThresholdChange,
  onWidthChange,
  onRemove,
}: {
  stripe: EditableStripe;
  index: number;
  disabled: boolean;
  onColorChange: (id: string, hex: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onRemove: (id: string) => void;
}) {
  const controls = useDragControls();
  const colorMeta = getStripeColorMeta(stripe.hex);
  const opacityPercent = Math.round(stripe.opacity * 100);

  return (
    <Reorder.Item
      as="div"
      value={stripe}
      dragListener={false}
      dragControls={controls}
      className="stripe-colors-detail-row"
    >
      <div className="stripe-colors-color-header">
        <button
          type="button"
          aria-label={`Reorder Stripe ${index + 1}`}
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
          triggerStyle={{ "--stripe-swatch-color": cssColorForHex(stripe.hex) } as CSSProperties}
          align="right"
        />
        <div className="stripe-colors-color-meta">
          <span className="stripe-colors-color-name">{colorMeta.name}</span>
          <span className="stripe-colors-color-code">[{colorMeta.code}]</span>
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
      <div className="stripe-colors-control-stack">
        <StripeControlRow label="Opacity">
          <div className="stripe-colors-leva-range hasRange">
            <LevaRangeSlider
              value={opacityPercent}
              min={STRIPE_OPACITY_MIN}
              max={STRIPE_OPACITY_MAX}
              step={1}
              initialValue={opacityPercent}
              disabled={disabled}
              ariaLabel={`Stripe ${index + 1} opacity`}
              onChange={(value) => onOpacityChange(stripe.id, value / 100)}
            />
          </div>
          <div className="stripe-colors-leva-input">
            <StripeNumberInput
              value={opacityPercent}
              formatValue={formatOpacityPercent}
              parseValue={parseOpacityInput}
              onValueChange={(value) => onOpacityChange(stripe.id, value / 100)}
              ariaLabel={`Stripe ${index + 1} opacity input`}
              disabled={disabled}
            />
          </div>
        </StripeControlRow>
        <StripeControlRow label="Threshold">
          <div className="stripe-colors-leva-range hasRange">
            <LevaRangeSlider
              value={stripe.startFrom}
              min={STRIPE_START_FROM_MIN}
              max={STRIPE_START_FROM_MAX}
              step={0.01}
              initialValue={stripe.startFrom}
              disabled={disabled}
              ariaLabel={`Stripe ${index + 1} threshold`}
              onChange={(value) => onThresholdChange(stripe.id, value)}
            />
          </div>
          <div className="stripe-colors-leva-input">
            <StripeNumberInput
              value={stripe.startFrom}
              formatValue={formatThreshold}
              parseValue={parseThresholdInput}
              onValueChange={(value) => onThresholdChange(stripe.id, value)}
              ariaLabel={`Stripe ${index + 1} threshold input`}
              disabled={disabled}
            />
          </div>
        </StripeControlRow>
        <StripeControlRow label="Width">
          <div className="stripe-colors-leva-range hasRange">
            <LevaRangeSlider
              value={stripe.width}
              min={STRIPE_WIDTH_MIN}
              max={STRIPE_WIDTH_MAX}
              step={0.5}
              initialValue={stripe.width}
              disabled={disabled}
              ariaLabel={`Stripe ${index + 1} width`}
              onChange={(value) => onWidthChange(stripe.id, value)}
            />
          </div>
          <div className="stripe-colors-leva-input">
            <StripeNumberInput
              value={stripe.width}
              formatValue={formatWidth}
              parseValue={parseWidthInput}
              onValueChange={(value) => onWidthChange(stripe.id, value)}
              ariaLabel={`Stripe ${index + 1} width input`}
              disabled={disabled}
            />
          </div>
        </StripeControlRow>
      </div>
    </Reorder.Item>
  );
}

export function StripeColorsTable({
  stripes,
  disabled = false,
  paletteOptions = [],
  paletteValue,
  rampEasingOptions = {},
  rampEasingValue,
  showRampEasing = false,
  thresholdEasingOptions = {},
  thresholdEasingValue,
  canUndoShuffle = false,
  onPaletteChange,
  onRampEasingChange,
  onThresholdEasingChange,
  onShufflePalette,
  onUndoShuffle,
  onReverseColorOrder,
  onColorChange,
  onOpacityChange,
  onThresholdChange,
  onWidthChange,
  onColorReorder,
  onAdd,
  onRemove,
}: StripeColorsTableProps) {
  const [order, setOrder] = useState<EditableStripe[]>(() => [...stripes]);
  const [colorsOpen, setColorsOpen] = useState(() => loadControlDrawerOpen("Colors", false));
  const reconcileKey = stripes.map((s) => `${s.id}:${s.hex}:${s.opacity}:${s.startFrom}:${s.width}`).join("|");

  useEffect(() => {
    setOrder([...stripes]);
  }, [reconcileKey]);

  return (
    <div className={cn("stripe-colors-table", disabled && "pointer-events-none opacity-45")}>
      {paletteOptions.length > 0 && onPaletteChange ? (
        <div className="stripe-colors-palette-wrap">
          <span className="stripe-colors-palette-title">Palette</span>
          <div className="stripe-colors-palette-toolbar">
            <select
              value={paletteValue ?? ""}
              disabled={disabled}
              aria-label="Stripe color palette"
              onChange={(event) => onPaletteChange(event.target.value)}
            >
              {paletteOptions.map((palette) => (
                <option key={palette} value={palette}>
                  {palette}
                </option>
              ))}
            </select>
            {onShufflePalette ? (
              <button
                type="button"
                className="stripe-colors-palette-action"
                disabled={disabled}
                onClick={onShufflePalette}
              >
                Shuffle
              </button>
            ) : null}
            {onUndoShuffle ? (
              <button
                type="button"
                className="stripe-colors-palette-action"
                disabled={disabled || !canUndoShuffle}
                onClick={onUndoShuffle}
              >
                Undo
              </button>
            ) : null}
            {onReverseColorOrder ? (
              <button
                type="button"
                className="stripe-colors-palette-action"
                disabled={disabled || stripes.length < 2}
                onClick={onReverseColorOrder}
              >
                Flip
              </button>
            ) : null}
          </div>
          {showRampEasing && onRampEasingChange ? (
            <EasingControl
              label="Brightness easing"
              value={rampEasingValue}
              options={rampEasingOptions}
              disabled={disabled}
              ariaLabel="Background ramp brightness easing"
              onChange={onRampEasingChange}
            />
          ) : null}
          {Object.keys(thresholdEasingOptions).length > 0 && onThresholdEasingChange ? (
            <EasingControl
              label="Threshold easing"
              value={thresholdEasingValue}
              options={thresholdEasingOptions}
              disabled={disabled}
              ariaLabel="Stripe threshold distribution easing"
              onChange={onThresholdEasingChange}
            />
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="stripe-colors-drawer-toggle"
        disabled={disabled}
        aria-expanded={colorsOpen}
        onClick={() =>
          setColorsOpen((open) => {
            const next = !open;
            saveControlDrawerOpen("Colors", next);
            return next;
          })
        }
      >
        {colorsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span>Colors</span>
        <span className="stripe-colors-drawer-count">{stripes.length}</span>
      </button>
      {colorsOpen ? (
        <div className="stripe-colors-drawer-panel">
          <Reorder.Group
            as="div"
            axis="y"
            values={order}
            onReorder={(next) => {
              setOrder(next);
              onColorReorder(next.map((s) => s.id));
            }}
            className="stripe-colors-detail-list"
          >
            {order.map((stripe, index) => (
              <StripeDetailRow
                key={stripe.id}
                stripe={stripe}
                index={index}
                disabled={disabled}
                onColorChange={onColorChange}
                onOpacityChange={onOpacityChange}
                onThresholdChange={onThresholdChange}
                onWidthChange={onWidthChange}
                onRemove={onRemove}
              />
            ))}
          </Reorder.Group>
          <button type="button" className="stripe-colors-add" disabled={disabled} onClick={onAdd}>
            <Plus size={11} />
            Add stripe
          </button>
        </div>
      ) : null}
    </div>
  );
}
