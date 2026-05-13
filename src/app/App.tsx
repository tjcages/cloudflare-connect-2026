import { useEffect, useState } from "react";
import { Layers2 } from "lucide-react";
import { copyDocumentPng } from "../canvas/pngExport";
import { GridCanvas } from "../canvas";
import { ComponentSidebar } from "../components/ComponentSidebar";
import { Sidebar } from "../components/Sidebar";
import { ICON_STROKE_WIDTH, RAIL_ICON_SIZE } from "../components/iconTokens";
import { useAppStore } from "../store";

const GridDividerIcon = ({
  size = RAIL_ICON_SIZE,
  strokeWidth = ICON_STROKE_WIDTH,
}: {
  size?: number;
  strokeWidth?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={strokeWidth}
    aria-hidden="true"
    focusable="false"
    data-testid="grid-divider-icon"
  >
    <path d="M8 4v16" />
    <path d="M16 4v16" />
    <path d="M4 8h16" />
    <path d="M4 16h16" />
  </svg>
);

export const App = () => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeTab, setActiveTab] = useState<"grid" | "components">("grid");

  const grid = useAppStore((s) => s.grid);
  const gridConfig = useAppStore((s) => s.gridConfig);
  const instances = useAppStore((s) => s.instances);
  const dragState = useAppStore((s) => s.dragState);
  const selectedInstance = useAppStore(
    (state) => state.instances.find((instance) => instance.id === state.selectedInstanceId) ?? null,
  );

  const replaceGridConfig = useAppStore((s) => s.replaceGridConfig);
  const updateGridConfig = useAppStore((s) => s.updateGridConfig);
  const regenerateSeed = useAppStore((s) => s.regenerateSeed);
  const setSmallRatio = useAppStore((s) => s.setSmallRatio);
  const setLargeRatio = useAppStore((s) => s.setLargeRatio);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const deleteInstance = useAppStore((s) => s.deleteInstance);
  const updateInstanceProps = useAppStore((s) => s.updateInstanceProps);
  const startCreateDrag = useAppStore((s) => s.startCreateDrag);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);

  useEffect(() => {
    if (dragState === null) {
      return;
    }

    const clearDrag = () => {
      endCanvasDrag();
    };

    window.addEventListener("pointerup", clearDrag);

    return () => window.removeEventListener("pointerup", clearDrag);
  }, [dragState, endCanvasDrag]);

  const copyPng = async () => {
    try {
      await copyDocumentPng();
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1600);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar-rail" aria-label="Builder tools">
        <button
          className={activeTab === "grid" ? "sidebar-rail-button sidebar-rail-button-active" : "sidebar-rail-button"}
          type="button"
          aria-label="Grid"
          aria-pressed={activeTab === "grid"}
          onClick={() => setActiveTab("grid")}
        >
          <GridDividerIcon />
        </button>
        <button
          className={
            activeTab === "components" ? "sidebar-rail-button sidebar-rail-button-active" : "sidebar-rail-button"
          }
          type="button"
          aria-label="Components"
          aria-pressed={activeTab === "components"}
          onClick={() => setActiveTab("components")}
        >
          <Layers2 size={RAIL_ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" focusable="false" />
        </button>
      </aside>
      <aside className={activeTab === "components" ? "sidebar sidebar-components" : "sidebar"}>
        {activeTab === "grid" ? (
          <Sidebar
            config={{
              ...gridConfig,
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
            onConfigChange={replaceGridConfig}
            onSmallRatioChange={setSmallRatio}
            onLargeRatioChange={setLargeRatio}
            onStrokeColorChange={(strokeColor) => updateGridConfig({ strokeColor })}
            onGenerate={regenerateSeed}
            onGapMaskChange={(gapMask) => updateGridConfig({ gapMask })}
            onCopyPng={() => void copyPng()}
            copyState={copyState}
          />
        ) : (
          <ComponentSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onSelectInstance={(id) => selectInstance(id)}
            onBack={() => selectInstance(null)}
            onDeleteInstance={deleteInstance}
            onUpdateInstanceProps={updateInstanceProps}
            onStartComponentDrag={startCreateDrag}
          />
        )}
      </aside>
      <section className="canvas-panel">
        <GridCanvas
          onUserSelectedInstance={(id) => {
            if (id !== null && id !== undefined) {
              setActiveTab("components");
            }
          }}
          onPlacedNewInstance={() => setActiveTab("components")}
        />
      </section>
    </main>
  );
};
