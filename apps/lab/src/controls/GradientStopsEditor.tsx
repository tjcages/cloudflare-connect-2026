import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Plus, X } from "lucide-react";
import { HexColorPopover } from "../components/HexColorPopover";
import { cssColorForHex, findLibraryColorByHex } from "../components/colorLibrary";
import { cn } from "../lib/cn";
import {
  addTwizzlerGradientStop,
  moveTwizzlerGradientStop,
  nearestTwizzlerGradientStopId,
  offsetFromClientX,
  recolorTwizzlerGradientStop,
  removeTwizzlerGradientStop,
  twizzlerGradientCss,
  TWIZZLER_GRADIENT_STOP_MAX,
  TWIZZLER_GRADIENT_STOP_MIN,
  type TwizzlerGradientStop,
} from "../twizzlerGradient";

function normalizeHexDisplay(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : value;
}

export type GradientStopsEditorProps = {
  stops: readonly TwizzlerGradientStop[];
  disabled?: boolean;
  onChange: (stops: TwizzlerGradientStop[]) => void;
};

export function GradientStopsEditor({ stops, disabled = false, onChange }: GradientStopsEditorProps) {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const dragId = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(stops[0]?.id ?? null);

  useEffect(() => {
    if (selectedId && stops.some((stop) => stop.id === selectedId)) return;
    setSelectedId(stops[0]?.id ?? null);
  }, [selectedId, stops]);

  const selected = stops.find((stop) => stop.id === selectedId) ?? stops[0] ?? null;
  const canAdd = !disabled && stops.length < TWIZZLER_GRADIENT_STOP_MAX;
  const canRemove = !disabled && stops.length > TWIZZLER_GRADIENT_STOP_MIN && !!selected;

  const commit = (next: TwizzlerGradientStop[]) => {
    onChange(next);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragId.current = id;
    setSelectedId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return;
    commit(moveTwizzlerGradientStop(stops, id, offsetFromClientX(event.clientX, bounds)));
  };

  const handleGraphPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const nearId = nearestTwizzlerGradientStopId(stops, event.clientX, bounds);
    if (nearId) {
      beginDrag(event, nearId);
      return;
    }
    if (!canAdd) return;
    const offset = offsetFromClientX(event.clientX, bounds);
    const next = addTwizzlerGradientStop(stops, offset);
    const created = next.find((stop) => !stops.some((existing) => existing.id === stop.id));
    if (created) setSelectedId(created.id);
    commit(next);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || !dragId.current) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return;
    commit(moveTwizzlerGradientStop(stops, dragId.current, offsetFromClientX(event.clientX, bounds)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
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
        <span className="twizzler-gradient-editor-title">Ramp</span>
        <div className="twizzler-gradient-editor-actions">
          <button
            type="button"
            className="twizzler-gradient-editor-action"
            disabled={!canAdd}
            aria-label="Add gradient stop"
            onClick={() => {
              if (!canAdd) return;
              const next = addTwizzlerGradientStop(stops, 0.5);
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
            aria-label="Remove selected gradient stop"
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
        <div
          ref={graphRef}
          className="twizzler-gradient-track"
          aria-label="Gradient color stops"
          onPointerDown={handleGraphPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="twizzler-gradient-fill" style={{ background: twizzlerGradientCss(stops) }} />
          <div className="twizzler-gradient-baseline" />
          {stops.map((stop) => (
            <button
              key={stop.id}
              type="button"
              className={cn("twizzler-gradient-handle", stop.id === selected?.id && "is-selected")}
              style={
                {
                  left: `${stop.offset * 100}%`,
                  "--twizzler-gradient-handle-color": cssColorForHex(stop.color),
                } as CSSProperties
              }
              aria-label={`Gradient stop at ${Math.round(stop.offset * 100)} percent`}
              disabled={disabled}
              onPointerDown={(event) => beginDrag(event, stop.id)}
            />
          ))}
        </div>
      </div>
      {selected ? (
        <div className="twizzler-gradient-selected">
          <HexColorPopover
            color={selected.color}
            onChange={(hex) => commit(recolorTwizzlerGradientStop(stops, selected.id, hex))}
            disabled={disabled}
            ariaLabel="Selected gradient stop color"
            triggerClassName="library-color-input-swatch"
            triggerStyle={{ "--library-color-input-color": cssColorForHex(selected.color) } as CSSProperties}
            align="right"
          />
          <div className="twizzler-gradient-selected-meta">
            <span className="twizzler-gradient-selected-name">{colorMeta.name}</span>
            <span className="twizzler-gradient-selected-code">[{colorMeta.code}]</span>
          </div>
          <span className="twizzler-gradient-selected-offset">{Math.round(selected.offset * 100)}%</span>
        </div>
      ) : null}
    </div>
  );
}
