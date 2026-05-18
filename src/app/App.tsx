import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getCanvasPoint, isPointerOverCanvas } from "../canvas/coords";
import { copyDocumentPng } from "../canvas/pngExport";
import { GridCanvas } from "../canvas";
import { CanvasViewportToolbar } from "../components/CanvasViewportToolbar";
import { ComponentDragGhost } from "../components/ComponentDragGhost";
import { RAIL_TAB_ICON_PX, RAIL_TAB_ICON_STROKE_WIDTH } from "../components/iconTokens";
import { ComponentIcon } from "../components/ComponentIcon";
import { ComponentBrowseSidebar, ComponentConfigSidebar } from "../components/ComponentSidebar";
import { PresetsSidebar } from "../components/PresetsSidebar";
import { RailTab } from "../components/RailTab";
import { Sidebar } from "../components/Sidebar";
import { cn } from "../lib/cn";
import { useAppStore } from "../store";
import { useAppShortcuts } from "./useAppShortcuts";

type SidebarTab = "grid" | "components" | "presets";

const ACTIVE_TAB_STORAGE_KEY = "section-grid-generator.active-tab";

const readPersistedActiveTab = (): SidebarTab => {
  try {
    const value = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return value === "components" || value === "grid" || value === "presets" ? value : "grid";
  } catch {
    return "grid";
  }
};

export const App = () => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeTab, setActiveTab] = useState<SidebarTab>(readPersistedActiveTab);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // Keep the UI usable if storage is unavailable.
    }
  }, [activeTab]);

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
    if (target instanceof Element && target.closest("[data-canvas-toolbar]") !== null) {
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
    <main className="grid h-screen min-h-0 w-full min-w-0 grid-cols-[44px_260px_minmax(0,1fr)_260px] overflow-hidden">
      <aside className="flex flex-col items-center gap-1.5 border-r border-builder-hairline bg-builder-surface p-1.5">
        <RailTab
          tab="grid"
          activeTab={activeTab}
          testId="rail-tab-grid"
          iconTestId="grid-divider-icon"
          onSelect={(tab) => setActiveTab(tab as SidebarTab)}
        >
          <ComponentIcon
            iconId="builder-grid"
            color="currentColor"
            size={RAIL_TAB_ICON_PX}
            strokeWidth={RAIL_TAB_ICON_STROKE_WIDTH}
          />
        </RailTab>
        <RailTab
          tab="components"
          activeTab={activeTab}
          testId="rail-tab-components"
          iconTestId="components-rail-icon"
          onSelect={(tab) => setActiveTab(tab as SidebarTab)}
        >
          <ComponentIcon
            iconId="builder-layers"
            color="currentColor"
            size={RAIL_TAB_ICON_PX}
            strokeWidth={RAIL_TAB_ICON_STROKE_WIDTH}
          />
        </RailTab>
        <RailTab
          tab="presets"
          activeTab={activeTab}
          testId="rail-tab-presets"
          iconTestId="presets-rail-icon"
          onSelect={(tab) => setActiveTab(tab as SidebarTab)}
        >
          <ComponentIcon
            iconId="builder-bookmark"
            color="currentColor"
            size={RAIL_TAB_ICON_PX}
            strokeWidth={RAIL_TAB_ICON_STROKE_WIDTH}
          />
        </RailTab>
      </aside>
      <aside
        className={cn(
          "flex min-h-0 flex-col border-r border-builder-hairline bg-builder-surface",
          activeTab === "grid" ? "gap-3.5 overflow-auto p-3.5" : "gap-0 overflow-hidden p-0",
        )}
      >
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
        ) : activeTab === "components" ? (
          <ComponentBrowseSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onSelectInstance={(id) => selectInstance(id)}
            onStartComponentDrag={startCreateDrag}
            onReorderInstances={reorderInstances}
            gridStrokeColor={gridConfig.strokeColor}
          />
        ) : (
          <PresetsSidebar />
        )}
      </aside>
      <section
        className="box-border flex min-h-0 min-w-0 w-full flex-col overflow-hidden bg-builder-surface"
        data-testid="canvas-panel"
        onPointerDown={onCanvasPanelBackgroundPointerDown}
      >
        <div
          className="box-border flex flex-1 min-h-0 items-center justify-center overflow-hidden p-8"
          data-canvas-scroll-panel
        >
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
      <aside className="flex min-h-0 min-w-0 w-full flex-col gap-0 overflow-hidden border-l border-builder-hairline border-r-0 bg-builder-surface p-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ComponentConfigSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onUpdateInstanceProps={updateInstanceProps}
            onStartEndpointPick={startConnectorEndpointPick}
            gridStrokeColor={gridConfig.strokeColor}
          />
        </div>
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
