import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { ChevronDown, ChevronRight, GripVertical, X, Plus } from "lucide-react";
import { Components } from "leva/plugin";
import {
  I as Indicator,
  q as Range,
  l as RangeWrapper,
  S as Scrubber,
  j as invertedRange,
  r as levaRange,
  k as sanitizeLevaStep,
  e as useDrag,
  d as useTh,
} from "leva/dist/vector-plugin-5e122f40.esm.js";
import { HexColorPopover } from "../components/HexColorPopover";
import { COLOR_LIBRARY, cssColorForHex } from "../components/colorLibrary";
import { cn } from "../lib/cn";
import { loadControlDrawerOpen, saveControlDrawerOpen } from "./drawerState";
import { DEFAULT_CUSTOM_EASING, easeValue, formatCustomEasing, parseCustomEasing } from "./easing";
import type { EditableStripe } from "./stripeAdapter";

const STRIPE_START_FROM_MIN = 0;
const STRIPE_START_FROM_MAX = 0.8;
const STRIPE_WIDTH_MIN = 0.5;
const STRIPE_WIDTH_MAX = 64;
const STRIPE_OPACITY_MIN = 0;
const STRIPE_OPACITY_MAX = 100;
const { Select: LevaSelect } = Components;

function parseNumberLike(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
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

function clampRangeValue(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function formatNumberDraft(value: number): string {
  return Number(value.toFixed(4)).toString();
}

export type StripeColorsTableProps = {
  stripes: readonly EditableStripe[];
  disabled?: boolean;
  rampEasingOptions?: Readonly<Record<string, string>>;
  rampEasingValue?: string;
  showRampEasing?: boolean;
  showColorControls?: boolean;
  showSavePalette?: boolean;
  thresholdEasingOptions?: Readonly<Record<string, string>>;
  thresholdEasingValue?: string;
  canUndoShuffle?: boolean;
  onRampEasingChange?: (easing: string) => void;
  onThresholdEasingChange?: (easing: string) => void;
  onShufflePalette?: () => void;
  onUndoShuffle?: () => void;
  onReverseColorOrder?: () => void;
  onSavePalette?: () => void;
  onColorChange: (id: string, hex: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onThresholdChange: (id: string, value: number) => void;
  onWidthChange: (id: string, value: number) => void;
  onColorReorder: (orderedIds: string[]) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

function LevaNumberControl({
  value,
  min,
  max,
  step,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => formatNumberDraft(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatNumberDraft(value));
  }, [focused, value]);

  const commit = (raw: string, normalizeDraft: boolean) => {
    const parsed = parseNumberLike(raw);
    if (parsed === null) {
      if (normalizeDraft) setDraft(formatNumberDraft(value));
      return;
    }
    const next = clampRangeValue(parsed, min, max);
    onChange(next);
    if (normalizeDraft) setDraft(formatNumberDraft(next));
  };

  const handleChange = (raw: string) => {
    if (!/^-?\d*([.,]\d*)?$/.test(raw)) return;
    setDraft(raw);
    if (raw === "" || raw === "-" || raw.endsWith(".") || raw.endsWith(",")) return;
    commit(raw, false);
  };

  const handleStep = (direction: number) => {
    const parsed = parseNumberLike(draft) ?? value;
    const next = clampRangeValue(parsed + direction * step, min, max);
    onChange(next);
    setDraft(formatNumberDraft(next));
  };

  return (
    <div className="stripe-colors-leva-number" aria-label={ariaLabel}>
      <input
        className="stripe-colors-number-input"
        value={draft}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit(draft, true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
            return;
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            handleStep(event.key === "ArrowUp" ? 1 : -1);
          }
        }}
        onChange={(event) => handleChange(event.currentTarget.value)}
      />
    </div>
  );
}

function LevaRangeSlider({
  value,
  min,
  max,
  step,
  initialValue,
  onDrag,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  initialValue: number;
  onDrag: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const rangeWidth = useRef(0);
  const scrubberWidth = useTh("sizes", "scrubberWidth");

  const bind = useDrag(({ event, first, xy: [x], movement: [mx], memo }: any) => {
    if (first) {
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds) return value;
      rangeWidth.current = bounds.width - parseFloat(String(scrubberWidth));
      const targetIsScrub = event?.target === scrubberRef.current;
      memo = targetIsScrub ? value : invertedRange((x - bounds.left) / bounds.width, min, max);
    }
    const next = memo + invertedRange(mx / rangeWidth.current, 0, max - min);
    onDrag(sanitizeLevaStep(next, { step, initialValue }));
    return memo;
  });

  const pos = levaRange(value, min, max);

  return (
    <RangeWrapper ref={ref} {...bind()}>
      <Range>
        <Indicator style={{ left: 0, right: `${(1 - pos) * 100}%` }} />
      </Range>
      <Scrubber ref={scrubberRef} style={{ left: `calc(${pos} * (100% - ${scrubberWidth}))` }} />
    </RangeWrapper>
  );
}

function LevaSliderControl({
  value,
  min,
  max,
  step,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  const update = (next: number) => onChange(clampRangeValue(next, min, max));

  return (
    <div className="hasRange stripe-colors-leva-range-grid" aria-label={ariaLabel}>
      <LevaRangeSlider
        value={value}
        min={min}
        max={max}
        step={step}
        initialValue={min}
        onDrag={disabled ? () => {} : update}
      />
      <LevaNumberControl
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        ariaLabel={`${ariaLabel} input`}
        onChange={update}
      />
    </div>
  );
}

function LevaSelectControl({
  value,
  options,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: string;
  options: readonly { label: string; value: string }[];
  disabled: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const keys = options.map((option) => option.label);
  const values = options.map((option) => option.value);
  const displayValue = Math.max(0, values.indexOf(value));

  return (
    <div className="stripe-colors-leva-select" aria-label={ariaLabel}>
      <LevaSelect
        id={id}
        value={value}
        displayValue={displayValue}
        onUpdate={(next: string) => onChange(next)}
        settings={{ keys, values }}
        disabled={disabled}
      />
    </div>
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
        <LevaSelectControl
          value={selectValue}
          disabled={disabled}
          ariaLabel={ariaLabel}
          options={[
            ...Object.entries(options).map(([optionLabel, optionValue]) => ({
              label: optionLabel,
              value: optionValue,
            })),
            { label: "Custom", value: "__custom" },
          ]}
          onChange={(nextValue) => onChange(nextValue === "__custom" ? customValue : nextValue)}
        />
        <EasingGraph value={value} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  );
}

function StripeDetailRow({
  stripe,
  index,
  disabled,
  showColorControls,
  onColorChange,
  onOpacityChange,
  onThresholdChange,
  onWidthChange,
  onRemove,
}: {
  stripe: EditableStripe;
  index: number;
  disabled: boolean;
  showColorControls: boolean;
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
        {showColorControls ? (
          <>
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
          </>
        ) : (
          <>
            <div className="stripe-colors-leva-swatch stripe-colors-leva-swatch-placeholder" aria-hidden="true" />
            <div className="stripe-colors-color-meta">
              <span className="stripe-colors-color-name">Level {index + 1}</span>
              <span className="stripe-colors-color-code">[image colors]</span>
            </div>
          </>
        )}
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
          <LevaSliderControl
            value={opacityPercent}
            min={STRIPE_OPACITY_MIN}
            max={STRIPE_OPACITY_MAX}
            step={1}
            disabled={disabled}
            ariaLabel={`Stripe ${index + 1} opacity`}
            onChange={(value) => onOpacityChange(stripe.id, value / 100)}
          />
        </StripeControlRow>
        <StripeControlRow label="Threshold">
          <LevaSliderControl
            value={stripe.startFrom}
            min={STRIPE_START_FROM_MIN}
            max={STRIPE_START_FROM_MAX}
            step={0.01}
            disabled={disabled}
            ariaLabel={`Stripe ${index + 1} threshold`}
            onChange={(value) => onThresholdChange(stripe.id, value)}
          />
        </StripeControlRow>
        <StripeControlRow label="Width">
          <LevaSliderControl
            value={stripe.width}
            min={STRIPE_WIDTH_MIN}
            max={STRIPE_WIDTH_MAX}
            step={0.5}
            disabled={disabled}
            ariaLabel={`Stripe ${index + 1} width`}
            onChange={(value) => onWidthChange(stripe.id, value)}
          />
        </StripeControlRow>
      </div>
    </Reorder.Item>
  );
}

export function StripeColorsTable({
  stripes,
  disabled = false,
  rampEasingOptions = {},
  rampEasingValue,
  showRampEasing = false,
  showColorControls = true,
  showSavePalette = false,
  thresholdEasingOptions = {},
  thresholdEasingValue,
  canUndoShuffle = false,
  onRampEasingChange,
  onThresholdEasingChange,
  onShufflePalette,
  onUndoShuffle,
  onReverseColorOrder,
  onSavePalette,
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

  const hasEasingControls =
    (showRampEasing && !!onRampEasingChange) ||
    (Object.keys(thresholdEasingOptions).length > 0 && !!onThresholdEasingChange);
  const hasPaletteActions = !!onShufflePalette || !!onUndoShuffle || !!onReverseColorOrder;

  return (
    <div className={cn("stripe-colors-table", disabled && "pointer-events-none opacity-45")}>
      {hasPaletteActions || hasEasingControls ? (
        <div className="stripe-colors-palette-wrap">
          <span className="stripe-colors-palette-title">Distribution</span>
          {hasPaletteActions ? (
            <div className="stripe-colors-palette-toolbar">
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
          ) : null}
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
        <span>{showColorControls ? "Colors" : "Levels"}</span>
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
                showColorControls={showColorControls}
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
          {showSavePalette && onSavePalette ? (
            <button type="button" className="stripe-colors-save" disabled={disabled} onClick={onSavePalette}>
              Save palette
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
