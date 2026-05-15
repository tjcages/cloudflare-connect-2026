import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCanvasPoint, isPointerOverCanvas } from "../canvas/coords";
import { copyDocumentPng } from "../canvas/pngExport";
import { GridCanvas } from "../canvas";
import { CanvasViewportToolbar } from "../components/CanvasViewportToolbar";
import { ComponentDragGhost } from "../components/ComponentDragGhost";
import { RAIL_TAB_ICON_PX, RAIL_TAB_ICON_STROKE_WIDTH } from "../components/iconTokens";
import { ComponentIcon } from "../components/ComponentIcon";
import { ComponentBrowseSidebar, ComponentConfigSidebar } from "../components/ComponentSidebar";
import { Sidebar } from "../components/Sidebar";
import { useAppStore } from "../store";
import { useAppShortcuts } from "./useAppShortcuts";

export const App = () => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeTab, setActiveTab] = useState<"grid" | "components">("grid");
  const builderCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const grid = useAppStore((s) => s.grid);
  const gridConfig = useAppStore((s) => s.gridConfig);
  const instances = useAppStore((s) => s.instances);
  const dragState = useAppStore((s) => s.dragState);
  const isCreatePlacementDrag = useAppStore((s) => s.dragState?.mode === "create");
  const hasActiveDrag = useAppStore((s) => s.dragState !== null);
  const selectedInstance = useAppStore(
    (state) => state.instances.find((instance) => instance.id === state.selectedInstanceId) ?? null,
  );

  const replaceGridConfig = useAppStore((s) => s.replaceGridConfig);
  const updateGridConfig = useAppStore((s) => s.updateGridConfig);
  const regenerateSeed = useAppStore((s) => s.regenerateSeed);
  const setSmallRatio = useAppStore((s) => s.setSmallRatio);
  const setLargeRatio = useAppStore((s) => s.setLargeRatio);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const cancelConnectorEndpointPick = useAppStore((s) => s.cancelConnectorEndpointPick);
  const reorderInstances = useAppStore((s) => s.reorderInstances);
  const updateInstanceProps = useAppStore((s) => s.updateInstanceProps);
  const startCreateDrag = useAppStore((s) => s.startCreateDrag);
  const revertCreatePreviewToGhost = useAppStore((s) => s.revertCreatePreviewToGhost);
  const updateCreatePreview = useAppStore((s) => s.updateCreatePreview);
  const finalizeCreateAt = useAppStore((s) => s.finalizeCreateAt);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);
  const startConnectorEndpointPick = useAppStore((s) => s.startConnectorEndpointPick);

  useAppShortcuts();

  const onCanvasPanelBackgroundPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (useAppStore.getState().dragState !== null) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (target instanceof Element && target.closest(".canvas-panel-viewport-toolbar") !== null) {
      return;
    }
    const panel = event.currentTarget;
    const canvasRoot = panel.querySelector('[data-testid="builder-canvas"]');
    if (canvasRoot instanceof Element && (canvasRoot === target || canvasRoot.contains(target))) {
      return;
    }

    selectInstance(null);
    cancelConnectorEndpointPick();
  };

  useEffect(() => {
    if (!hasActiveDrag) {
      return undefined;
    }

    const onPointerUp = (event: PointerEvent) => {
      const d = useAppStore.getState().dragState;
      if (d === null) {
        return;
      }

      if (d.mode === "create") {
        const canvasEl = builderCanvasRef.current;
        const { grid: placementGrid } = useAppStore.getState();
        if (canvasEl && isPointerOverCanvas(canvasEl, event.clientX, event.clientY)) {
          const logical = getCanvasPoint(
            canvasEl,
            event.clientX,
            event.clientY,
            placementGrid.config.logicalWidth,
            placementGrid.config.logicalHeight,
          );
          finalizeCreateAt(d.type, logical.x, logical.y);
          setActiveTab("components");
        } else {
          endCanvasDrag();
        }

        return;
      }

      endCanvasDrag();
    };

    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [hasActiveDrag, endCanvasDrag, finalizeCreateAt]);

  useEffect(() => {
    if (!isCreatePlacementDrag) {
      return undefined;
    }

    const onPointerMove = (event: PointerEvent) => {
      const d = useAppStore.getState().dragState;
      if (d?.mode !== "create") {
        return;
      }

      const canvasEl = builderCanvasRef.current;
      const { grid: placementGrid } = useAppStore.getState();

      if (canvasEl && isPointerOverCanvas(canvasEl, event.clientX, event.clientY)) {
        const logical = getCanvasPoint(
          canvasEl,
          event.clientX,
          event.clientY,
          placementGrid.config.logicalWidth,
          placementGrid.config.logicalHeight,
        );
        updateCreatePreview(d.type, logical.x, logical.y);
      } else {
        revertCreatePreviewToGhost(event.clientX, event.clientY);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [isCreatePlacementDrag, revertCreatePreviewToGhost, updateCreatePreview]);

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
      <aside className="sidebar-rail">
        <button
          className={activeTab === "grid" ? "sidebar-rail-button sidebar-rail-button-active" : "sidebar-rail-button"}
          type="button"
          data-testid="rail-tab-grid"
          onClick={() => setActiveTab("grid")}
        >
          <span data-testid="grid-divider-icon">
            <ComponentIcon
              iconId="builder-grid"
              color="currentColor"
              size={RAIL_TAB_ICON_PX}
              strokeWidth={RAIL_TAB_ICON_STROKE_WIDTH}
            />
          </span>
        </button>
        <button
          className={
            activeTab === "components" ? "sidebar-rail-button sidebar-rail-button-active" : "sidebar-rail-button"
          }
          type="button"
          data-testid="rail-tab-components"
          onClick={() => setActiveTab("components")}
        >
          <span data-testid="components-rail-icon">
            <ComponentIcon
              iconId="builder-layers"
              color="currentColor"
              size={RAIL_TAB_ICON_PX}
              strokeWidth={RAIL_TAB_ICON_STROKE_WIDTH}
            />
          </span>
        </button>
      </aside>
      <aside className={activeTab === "components" ? "sidebar sidebar-components" : "sidebar ui-scroll-overlay"}>
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
          <ComponentBrowseSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onSelectInstance={(id) => selectInstance(id)}
            onStartComponentDrag={startCreateDrag}
            onReorderInstances={reorderInstances}
            gridStrokeColor={gridConfig.strokeColor}
          />
        )}
      </aside>
      <section className="canvas-panel" data-testid="canvas-panel" onPointerDown={onCanvasPanelBackgroundPointerDown}>
        <div className="canvas-panel-scroll">
          <GridCanvas
            canvasRef={builderCanvasRef}
            onUserSelectedInstance={(id) => {
              if (id !== null && id !== undefined) {
                setActiveTab("components");
              }
            }}
          />
        </div>
        <CanvasViewportToolbar canvasRef={builderCanvasRef} />
      </section>
      <aside className="sidebar sidebar-components sidebar-components-config">
        <ComponentConfigSidebar
          instances={instances}
          selectedInstance={selectedInstance}
          onUpdateInstanceProps={updateInstanceProps}
          onStartEndpointPick={startConnectorEndpointPick}
          gridStrokeColor={gridConfig.strokeColor}
        />
      </aside>
      {dragState?.mode === "create" && dragState.preview === null && dragState.ghostClient !== null ? (
        <ComponentDragGhost
          componentType={dragState.type}
          clientX={dragState.ghostClient.x}
          clientY={dragState.ghostClient.y}
        />
      ) : null}
    </main>
  );
};
