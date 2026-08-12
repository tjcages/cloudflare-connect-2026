import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Plus, X } from "lucide-react";
import { HexColorPopover } from "../components/HexColorPopover";
import { cssColorForHex, findLibraryColorByHex } from "../components/colorLibrary";
import { cn } from "../lib/cn";
import {
  addTwizzlerGradientStop,
  moveTwizzlerGradientStop,
  nearestTwizzlerGradientStopId,
  rasterizeTwizzlerGradientField,
  recolorTwizzlerGradientStop,
  removeTwizzlerGradientStop,
  TWIZZLER_GRADIENT_STOP_MAX,
  TWIZZLER_GRADIENT_STOP_MIN,
  type TwizzlerGradientStop,
} from "../twizzlerGradient";

const GRAPH_WIDTH = 168;
const GRAPH_HEIGHT = 88;
const GRAPH_PAD = 10;
const HANDLE_HIT_UV = 0.09;
const FIELD_PREVIEW_WIDTH = 148;
const FIELD_PREVIEW_HEIGHT = 68;

function normalizeHexDisplay(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : value;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function innerWidth(): number {
  return GRAPH_WIDTH - GRAPH_PAD * 2;
}

function innerHeight(): number {
  return GRAPH_HEIGHT - GRAPH_PAD * 2;
}

function pointX(x: number): number {
  return GRAPH_PAD + x * innerWidth();
}

function pointY(y: number): number {
  return GRAPH_PAD + y * innerHeight();
}

function graphUvFromClient(clientX: number, clientY: number, bounds: DOMRect): { x: number; y: number } {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  const svgX = ((clientX - bounds.left) / bounds.width) * GRAPH_WIDTH;
  const svgY = ((clientY - bounds.top) / bounds.height) * GRAPH_HEIGHT;
  return {
    x: clamp01((svgX - GRAPH_PAD) / innerWidth()),
    y: clamp01((svgY - GRAPH_PAD) / innerHeight()),
  };
}

export type GradientStopsEditorProps = {
  stops: readonly TwizzlerGradientStop[];
  disabled?: boolean;
  onChange: (stops: TwizzlerGradientStop[]) => void;
};

export function GradientStopsEditor({ stops, disabled = false, onChange }: GradientStopsEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
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

  const pointerUv = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return graphUvFromClient(event.clientX, event.clientY, bounds);
  };

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>, id: string, uv: { x: number; y: number }) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragId.current = id;
    setSelectedId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    commit(moveTwizzlerGradientStop(stops, id, uv.x, uv.y));
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    const uv = pointerUv(event);
    if (!uv) return;
    const nearId = nearestTwizzlerGradientStopId(stops, uv.x, uv.y, HANDLE_HIT_UV);
    if (nearId) {
      beginDrag(event, nearId, uv);
      return;
    }
    if (!canAdd) return;
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

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || !dragId.current) return;
    event.preventDefault();
    event.stopPropagation();
    const uv = pointerUv(event);
    if (!uv) return;
    commit(moveTwizzlerGradientStop(stops, dragId.current, uv.x, uv.y));
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
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
      <div className={cn("twizzler-gradient-graph", !disabled && "is-editable")}>
        <canvas
          ref={fieldRef}
          className="twizzler-gradient-field"
          width={FIELD_PREVIEW_WIDTH}
          height={FIELD_PREVIEW_HEIGHT}
          aria-hidden="true"
        />
        <svg
          ref={svgRef}
          className="twizzler-gradient-plane"
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
          aria-label="Gradient color hotspots"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <line
            x1={GRAPH_PAD}
            y1={GRAPH_HEIGHT - GRAPH_PAD}
            x2={GRAPH_WIDTH - GRAPH_PAD}
            y2={GRAPH_HEIGHT - GRAPH_PAD}
          />
          <line x1={GRAPH_PAD} y1={GRAPH_PAD} x2={GRAPH_PAD} y2={GRAPH_HEIGHT - GRAPH_PAD} />
          {stops.map((stop) => {
            const selectedStop = stop.id === selected?.id;
            return (
              <circle
                key={stop.id}
                className={cn("twizzler-gradient-handle", selectedStop && "is-selected")}
                cx={pointX(stop.x)}
                cy={pointY(stop.y)}
                r={selectedStop ? 5 : 4.2}
                fill={stop.color}
                aria-label={`Color hotspot at ${Math.round(stop.x * 100)} percent, ${Math.round(stop.y * 100)} percent`}
              />
            );
          })}
        </svg>
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
