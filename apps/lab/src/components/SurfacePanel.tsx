import type { ReactNode } from "react";
import { Eye, EyeOff, Pencil, Square, Trash2 } from "lucide-react";
import type { SurfaceArea, SurfaceAreaKind, SurfaceMode } from "../surfaceWorkspace";

type SurfacePanelProps = {
  mode: SurfaceMode;
  areas: readonly SurfaceArea[];
  selectedAreaId: string | null;
  drawingKind: SurfaceAreaKind | null;
  onModeChange: (mode: SurfaceMode) => void;
  onNewArea: (kind: SurfaceAreaKind) => void;
  onSelectArea: (id: string) => void;
  onToggleArea: (id: string) => void;
  onDeleteArea: (id: string) => void;
  children: ReactNode;
};

export function SurfacePanel({
  mode,
  areas,
  selectedAreaId,
  drawingKind,
  onModeChange,
  onNewArea,
  onSelectArea,
  onToggleArea,
  onDeleteArea,
  children,
}: SurfacePanelProps) {
  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? null;

  return (
    <div className="surface-panel">
      <div className="surface-panel-mode">
        <span className="surface-panel-label">Surface</span>
        <fieldset className="surface-mode-switch" aria-label="Surface mode">
          {(["full", "partial"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={mode === option ? "is-active" : ""}
              aria-pressed={mode === option}
              onClick={() => onModeChange(option)}
            >
              {option === "full" ? "Full" : "Partial"}
            </button>
          ))}
        </fieldset>
      </div>
      {mode === "partial" ? (
        <>
          <section className="surface-layers" aria-labelledby="surface-layers-title">
            <div className="surface-section-header">
              <div>
                <span id="surface-layers-title">Layers</span>
                <span className="surface-layer-count">{areas.length}</span>
              </div>
              <fieldset className="surface-new-area-actions" aria-label="Create area">
                <button
                  type="button"
                  className={`surface-new-area${drawingKind === "freeform" ? " is-active" : ""}`}
                  onClick={() => onNewArea("freeform")}
                  disabled={drawingKind !== null}
                  aria-label="Draw freeform area"
                  aria-pressed={drawingKind === "freeform"}
                >
                  <Pencil size={12} strokeWidth={1.75} aria-hidden />
                  Freeform
                </button>
                <button
                  type="button"
                  className={`surface-new-area${drawingKind === "frame" ? " is-active" : ""}`}
                  onClick={() => onNewArea("frame")}
                  disabled={drawingKind !== null}
                  aria-label="Draw frame"
                  aria-pressed={drawingKind === "frame"}
                >
                  <Square size={12} strokeWidth={1.75} aria-hidden />
                  Frame
                </button>
              </fieldset>
            </div>
            {areas.length > 0 ? (
              <div className="surface-layer-list">
                {areas.map((area) => {
                  const selected = area.id === selectedAreaId;
                  return (
                    <div
                      key={area.id}
                      className={`surface-layer-row${selected ? " is-selected" : ""}`}
                      data-area-id={area.id}
                    >
                      <button
                        className="surface-layer-select"
                        type="button"
                        onClick={() => onSelectArea(area.id)}
                        aria-pressed={selected}
                      >
                        <span className="surface-layer-swatch" aria-hidden />
                        <span className="surface-layer-name">{area.name}</span>
                      </button>
                      <div className="surface-layer-actions">
                        <button
                          type="button"
                          onClick={() => onToggleArea(area.id)}
                          aria-label={`${area.visible ? "Hide" : "Show"} ${area.name}`}
                          title={`${area.visible ? "Hide" : "Show"} ${area.name}`}
                        >
                          {area.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteArea(area.id)}
                          aria-label={`Delete ${area.name}`}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="surface-layer-empty">
                <span>No partial areas yet</span>
                <p>Create a freeform area or frame, then draw it directly on the canvas.</p>
              </div>
            )}
          </section>
          <section className="surface-config" aria-labelledby="surface-config-title">
            <div className="surface-config-header">
              <span id="surface-config-title">Config</span>
              <span>{selectedArea?.name ?? "Select a layer"}</span>
            </div>
            {selectedArea ? (
              <div className="surface-config-scroll">{children}</div>
            ) : (
              <div className="surface-config-empty">Select a layer to edit its config.</div>
            )}
          </section>
        </>
      ) : (
        <div className="surface-full-config">{children}</div>
      )}
    </div>
  );
}
