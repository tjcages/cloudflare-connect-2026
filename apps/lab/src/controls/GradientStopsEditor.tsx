import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Plus, X } from "lucide-react";
import { HexColorPopover } from "../components/HexColorPopover";
import { cssColorForHex, findLibraryColorByHex } from "../components/colorLibrary";
import { cn } from "../lib/cn";
import {
  addTwizzlerGradientStop,
  gradientFieldClientPlane,
  moveTwizzlerGradientStop,
  nearestTwizzlerGradientStopIdPx,
  rasterizeTwizzlerGradientField,
  recolorTwizzlerGradientStop,
  removeTwizzlerGradientStop,
  TWIZZLER_GRADIENT_HANDLE_HIT_PX,
  TWIZZLER_GRADIENT_STOP_MAX,
  TWIZZLER_GRADIENT_STOP_MIN,
  type TwizzlerGradientStop,
} from "../twizzlerGradient";

const GRAPH_WIDTH = 168;
const GRAPH_HEIGHT = 120;
const GRAPH_PAD = 12;
const FIELD_PREVIEW_WIDTH = 144;
const FIELD_PREVIEW_HEIGHT = 96;

function normalizeHexDisplay(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : value;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function graphUvFromClient(clientX: number, clientY: number, bounds: DOMRect): { x: number; y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  const svgX = ((clientX - bounds.left) / bounds.width) * GRAPH_WIDTH;
  const svgY = ((clientY - bounds.top) / bounds.height) * GRAPH_HEIGHT;
  return {
    x: clamp01((svgX - GRAPH_PAD) / (GRAPH_WIDTH - GRAPH_PAD * 2)),
    y: clamp01((svgY - GRAPH_PAD) / (GRAPH_HEIGHT - GRAPH_PAD * 2)),
  };
}

export type GradientStopsEditorProps = {
  stops: readonly TwizzlerGradientStop[];
  disabled?: boolean;
  onChange: (stops: TwizzlerGradientStop[]) => void;
};

export function GradientStopsEditor({ stops, disabled = false, onChange }: GradientStopsEditorProps) {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLCanvasElement | null>(null);
  const dragId = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(stops[0]?.id ?? null);

  useEffect(() => {
    if (selectedId && stops.some((stop) => stop.id === selectedId)) return;
    setSelectedId(stops[0]?.id ?? null);
  }, [selectedId, stops]);

  useEffect(() => {
    const canvas = fieldRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const pixels = rasterizeTwizzlerGradientField(stops, FIELD_PREVIEW_WIDTH, FIELD_PREVIEW_HEIGHT);
    const image = context.createImageData(FIELD_PREVIEW_WIDTH, FIELD_PREVIEW_HEIGHT);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  }, [stops]);

  const selected = stops.find((stop) => stop.id === selectedId) ?? stops[0] ?? null;
  const canAdd = !disabled && stops.length < TWIZZLER_GRADIENT_STOP_MAX;
  const canRemove = !disabled && stops.length > TWIZZLER_GRADIENT_STOP_MIN && !!selected;

  const commit = (next: TwizzlerGradientStop[]) => {
    onChange(next);
  };

  const pointerUv = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return graphUvFromClient(event.clientX, event.clientY, bounds);
  };

  const nearestHandleId = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    const plane = gradientFieldClientPlane(bounds, GRAPH_WIDTH, GRAPH_HEIGHT, GRAPH_PAD);
    return nearestTwizzlerGradientStopIdPx(stops, event.clientX, event.clientY, plane, TWIZZLER_GRADIENT_HANDLE_HIT_PX);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragId.current = id;
    setSelectedId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const nearId = nearestHandleId(event);
    if (nearId) {
      beginDrag(event, nearId);
      return;
    }
    const uv = pointerUv(event);
    if (!uv || !canAdd) return;
    event.preventDefault();
    event.stopPropagation();
    const next = addTwizzlerGradientStop(stops, uv.x, uv.y);
    const created = next.find((stop) => !stops.some((existing) => existing.id === stop.id));
    if (created) {
      setSelectedId(created.id);
      dragId.current = created.id;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    commit(next);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !dragId.current) return;
    event.preventDefault();
    event.stopPropagation();
    const uv = pointerUv(event);
    if (!uv) return;
    commit(moveTwizzlerGradientStop(stops, dragId.current, uv.x, uv.y));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragId.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const colorMeta = selected
    ? (() => {
        const match = findLibraryColorByHex(selected.color);
        return {
          name: match?.token ?? "Custom",
          code: normalizeHexDisplay(selected.color),
        };
      })()
    : { name: "", code: "" };

  return (
    <div className={cn("twizzler-gradient-editor", disabled && "is-disabled")}>
      <div className="twizzler-gradient-editor-header">
        <span className="twizzler-gradient-editor-title">Field</span>
        <div className="twizzler-gradient-editor-actions">
          <button
            type="button"
            className="twizzler-gradient-editor-action"
            disabled={!canAdd}
            aria-label="Add color hotspot"
            onClick={() => {
              if (!canAdd) return;
              const next = addTwizzlerGradientStop(stops);
              const created = next.find((stop) => !stops.some((existing) => existing.id === stop.id));
              if (created) setSelectedId(created.id);
              commit(next);
            }}
          >
            <Plus size={11} />
            Add
          </button>
          <button
            type="button"
            className="twizzler-gradient-editor-action"
            disabled={!canRemove}
            aria-label="Remove selected color hotspot"
            onClick={() => {
              if (!selected || !canRemove) return;
              commit(removeTwizzlerGradientStop(stops, selected.id));
            }}
          >
            <X size={11} />
            Remove
          </button>
        </div>
      </div>
      <div
        ref={graphRef}
        className={cn("twizzler-gradient-graph", !disabled && "is-editable")}
        aria-label="Gradient color hotspots"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <canvas
          ref={fieldRef}
          className="twizzler-gradient-field"
          width={FIELD_PREVIEW_WIDTH}
          height={FIELD_PREVIEW_HEIGHT}
          aria-hidden="true"
        />
        <svg
          className="twizzler-gradient-plane"
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <line
            x1={GRAPH_PAD}
            y1={GRAPH_HEIGHT - GRAPH_PAD}
            x2={GRAPH_WIDTH - GRAPH_PAD}
            y2={GRAPH_HEIGHT - GRAPH_PAD}
          />
          <line x1={GRAPH_PAD} y1={GRAPH_PAD} x2={GRAPH_PAD} y2={GRAPH_HEIGHT - GRAPH_PAD} />
        </svg>
        <div className="twizzler-gradient-handles">
          {stops.map((stop) => {
            const selectedStop = stop.id === selected?.id;
            return (
              <div
                key={stop.id}
                className={cn("twizzler-gradient-handle", selectedStop && "is-selected")}
                style={
                  {
                    left: `${stop.x * 100}%`,
                    top: `${stop.y * 100}%`,
                    backgroundColor: stop.color,
                  } as CSSProperties
                }
                aria-label={`Color hotspot at ${Math.round(stop.x * 100)} percent, ${Math.round(stop.y * 100)} percent`}
              />
            );
          })}
        </div>
      </div>
      {selected ? (
        <div className="twizzler-gradient-selected">
          <HexColorPopover
            color={selected.color}
            onChange={(hex) => commit(recolorTwizzlerGradientStop(stops, selected.id, hex))}
            disabled={disabled}
            ariaLabel="Selected color hotspot"
            triggerClassName="library-color-input-swatch"
            triggerStyle={{ "--library-color-input-color": cssColorForHex(selected.color) } as CSSProperties}
            align="right"
          />
          <div className="twizzler-gradient-selected-meta">
            <span className="twizzler-gradient-selected-name">{colorMeta.name}</span>
            <span className="twizzler-gradient-selected-code">[{colorMeta.code}]</span>
          </div>
          <span className="twizzler-gradient-selected-offset">
            {Math.round(selected.x * 100)}% · {Math.round(selected.y * 100)}%
          </span>
        </div>
      ) : null}
    </div>
  );
}
