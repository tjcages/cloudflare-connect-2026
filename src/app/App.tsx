import { useEffect, useRef, useState } from "react";
import { copyDocumentPng } from "../canvas/pngExport";
import { ComponentSidebar } from "../components/ComponentSidebar";
import { GridCanvas } from "../components/GridCanvas";
import { Sidebar } from "../components/Sidebar";
import { createComponentInstance, getComponentDefinition, snapComponentPosition } from "../components/componentRegistry";
import { DEFAULT_CONFIG, updateLargeRatio, updateSmallRatio } from "../grid/config";
import { useGeneratedGrid } from "../grid/useGeneratedGrid";
import type { ComponentInstance, ComponentType, GridConfig, IconBoxProps } from "../grid/types";

const createSeed = () => {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return `seed-${Date.now()}`;
};

type CanvasDragState =
  | {
      mode: "create";
      type: ComponentType;
      preview: ComponentInstance | null;
    }
  | {
      mode: "move";
      id: string;
      offsetX: number;
      offsetY: number;
    };

export const App = () => {
  const [config, setConfig] = useState<GridConfig>(DEFAULT_CONFIG);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeTab, setActiveTab] = useState<"grid" | "components">("grid");
  const [instances, setInstances] = useState<ComponentInstance[]>(() => [
    createComponentInstance("icon-box", 0, 0, 1, DEFAULT_CONFIG.width, DEFAULT_CONFIG.height),
  ]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<CanvasDragState | null>(null);
  const nextInstanceIndex = useRef(2);
  const { grid, isGenerating } = useGeneratedGrid(config);
  const selectedInstance = instances.find((instance) => instance.id === selectedInstanceId) ?? null;
  const isDragging = dragState !== null;

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const clearDrag = () => setDragState(null);
    window.addEventListener("pointerup", clearDrag);

    return () => window.removeEventListener("pointerup", clearDrag);
  }, [isDragging]);

  const copyPng = async () => {
    try {
      await copyDocumentPng({ grid, instances, scale: 2 });
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  const createInstance = (type: ComponentType, x: number, y: number) => {
    const instance = createComponentInstance(
      type,
      x,
      y,
      nextInstanceIndex.current,
      grid.config.logicalWidth,
      grid.config.logicalHeight,
    );
    nextInstanceIndex.current += 1;
    setInstances((current) => [...current, instance]);
    setSelectedInstanceId(instance.id);
    setActiveTab("components");
  };

  const moveInstance = (id: string, x: number, y: number) => {
    setInstances((current) =>
      current.map((instance) => {
        if (instance.id !== id) {
          return instance;
        }

        return {
          ...instance,
          ...snapComponentPosition(x, y, grid.config.logicalWidth, grid.config.logicalHeight, instance.type),
        };
      }),
    );
  };

  const startComponentDrag = (type: ComponentType) => {
    setDragState({ mode: "create", type, preview: null });
  };

  const updateComponentDragPreview = (type: ComponentType, x: number, y: number) => {
    const definition = getComponentDefinition(type);
    const position = snapComponentPosition(x, y, grid.config.logicalWidth, grid.config.logicalHeight, type);

    setDragState({
      mode: "create",
      type,
      preview: {
        id: `${type}-preview`,
        type,
        name: definition.label,
        ...position,
        props: {
          ...definition.defaultProps,
        },
      },
    });
  };

  const startInstanceDrag = (id: string, offsetX: number, offsetY: number) => {
    setDragState({ mode: "move", id, offsetX, offsetY });
  };

  const endCanvasDrag = () => {
    setDragState(null);
  };

  const deleteInstance = (id: string) => {
    setInstances((current) => current.filter((instance) => instance.id !== id));
    setSelectedInstanceId((current) => (current === id ? null : current));
  };

  const updateInstanceProps = (id: string, props: IconBoxProps) => {
    setInstances((current) => current.map((instance) => (instance.id === id ? { ...instance, props } : instance)));
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-tabs" role="tablist" aria-label="Builder tools">
          <button
            className={activeTab === "grid" ? "sidebar-tab sidebar-tab-active" : "sidebar-tab"}
            type="button"
            role="tab"
            aria-selected={activeTab === "grid"}
            onClick={() => setActiveTab("grid")}
          >
            Grid
          </button>
          <button
            className={activeTab === "components" ? "sidebar-tab sidebar-tab-active" : "sidebar-tab"}
            type="button"
            role="tab"
            aria-selected={activeTab === "components"}
            onClick={() => setActiveTab("components")}
          >
            Components
          </button>
        </div>
        {activeTab === "grid" ? (
          <Sidebar
            config={{
              ...config,
              gapMask: grid.config.gapMask,
            }}
            cellCount={grid.cells.length}
            logicalSize={{
              width: grid.config.logicalWidth,
              height: grid.config.logicalHeight,
            }}
            renderSize={{
              width: grid.config.renderWidth,
              height: grid.config.renderHeight,
            }}
            onConfigChange={setConfig}
            onSmallRatioChange={(value) => setConfig((current) => ({ ...current, ...updateSmallRatio(value) }))}
            onLargeRatioChange={(value) => setConfig((current) => ({ ...current, ...updateLargeRatio(value) }))}
            onStrokeColorChange={(strokeColor) => setConfig((current) => ({ ...current, strokeColor }))}
            onGenerate={() => setConfig((current) => ({ ...current, seed: createSeed() }))}
            onGapMaskChange={(gapMask) => setConfig((current) => ({ ...current, gapMask }))}
            onCopyPng={() => void copyPng()}
            copyState={copyState}
          />
        ) : (
          <ComponentSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onSelectInstance={setSelectedInstanceId}
            onBack={() => setSelectedInstanceId(null)}
            onDeleteInstance={deleteInstance}
            onUpdateInstanceProps={updateInstanceProps}
            onStartComponentDrag={startComponentDrag}
          />
        )}
      </aside>
      <section className="canvas-panel">
        <GridCanvas
          grid={grid}
          instances={instances}
          selectedInstanceId={selectedInstanceId}
          onSelectInstance={(id) => {
            setSelectedInstanceId(id);
            if (id) {
              setActiveTab("components");
            }
          }}
          onCreateInstance={createInstance}
          dragState={dragState}
          dragPreviewInstance={dragState?.mode === "create" ? dragState.preview : null}
          onUpdateComponentDragPreview={updateComponentDragPreview}
          onStartInstanceDrag={startInstanceDrag}
          onMoveInstance={moveInstance}
          onEndCanvasDrag={endCanvasDrag}
        />
      </section>
      {isGenerating ? <div className="generation-spinner" role="status" aria-label="Generating grid" /> : null}
    </main>
  );
};
