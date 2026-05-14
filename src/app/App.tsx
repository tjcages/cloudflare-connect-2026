import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCanvasPoint, isPointerOverCanvas } from "../canvas/coords";
import { getInstanceCanvasBounds } from "../lib/componentRegistry";
import { copyDocumentPng } from "../canvas/pngExport";
import { GridCanvas } from "../canvas";
import { ComponentDragGhost } from "../components/ComponentDragGhost";
import { RAIL_TAB_ICON_PX } from "../components/iconTokens";
import { ComponentIcon } from "../components/ComponentIcon";
import { ComponentBrowseSidebar, ComponentConfigSidebar } from "../components/ComponentSidebar";
import { Sidebar } from "../components/Sidebar";
import { useAppStore } from "../store";

export const App = () => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [activeTab, setActiveTab] = useState<"grid" | "components">("grid");
  const builderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasPanelRef = useRef<HTMLElement | null>(null);

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
  const deleteInstance = useAppStore((s) => s.deleteInstance);
  const reorderInstances = useAppStore((s) => s.reorderInstances);
  const updateInstanceProps = useAppStore((s) => s.updateInstanceProps);
  const startCreateDrag = useAppStore((s) => s.startCreateDrag);
  const revertCreatePreviewToGhost = useAppStore((s) => s.revertCreatePreviewToGhost);
  const updateCreatePreview = useAppStore((s) => s.updateCreatePreview);
  const finalizeCreateAt = useAppStore((s) => s.finalizeCreateAt);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);
  const startConnectorEndpointPick = useAppStore((s) => s.startConnectorEndpointPick);
  const cancelConnectorEndpointPick = useAppStore((s) => s.cancelConnectorEndpointPick);
  const hasConnectorEndpointPick = useAppStore((s) => s.connectorEndpointPick !== null);

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

  useEffect(() => {
    if (!hasConnectorEndpointPick) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelConnectorEndpointPick();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelConnectorEndpointPick, hasConnectorEndpointPick]);

  useEffect(() => {
    const isEditableEventTarget = (target: EventTarget | null) =>
      target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']") !== null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      if (isEditableEventTarget(event.target)) {
        return;
      }
      if (useAppStore.getState().dragState !== null) {
        return;
      }
      const id = useAppStore.getState().selectedInstanceId;
      if (id === null) {
        return;
      }
      event.preventDefault();
      deleteInstance(id);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteInstance]);

  useLayoutEffect(() => {
    const id = selectedInstance?.id;
    if (id == null) {
      return undefined;
    }

    const scrollCanvasToSelected = () => {
      const canvas = builderCanvasRef.current;
      const panel = canvasPanelRef.current;
      if (!canvas || !panel) {
        return;
      }

      const instance = useAppStore.getState().instances.find((i) => i.id === id);
      if (!instance) {
        return;
      }

      const { logicalWidth, logicalHeight } = useAppStore.getState().grid.config;
      const bounds = getInstanceCanvasBounds(instance);

      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw < 2 || ch < 2) {
        return;
      }

      const scaleX = cw / logicalWidth;
      const scaleY = ch / logicalHeight;

      const canvasRect = canvas.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const instLeft = canvasRect.left + bounds.x * scaleX;
      const instTop = canvasRect.top + bounds.y * scaleY;
      const instW = bounds.width * scaleX;
      const instH = bounds.height * scaleY;
      const instRight = instLeft + instW;
      const instBottom = instTop + instH;

      const pad = 6;
      if (
        instLeft >= panelRect.left + pad &&
        instRight <= panelRect.right - pad &&
        instTop >= panelRect.top + pad &&
        instBottom <= panelRect.bottom - pad
      ) {
        return;
      }

      const cx = instLeft + instW / 2;
      const cy = instTop + instH / 2;
      const pcx = panelRect.left + panelRect.width / 2;
      const pcy = panelRect.top + panelRect.height / 2;

      const dx = cx - pcx;
      const dy = cy - pcy;
      if (typeof panel.scrollBy === "function") {
        panel.scrollBy({
          left: dx,
          top: dy,
          behavior: "instant",
        });
      } else {
        panel.scrollLeft += dx;
        panel.scrollTop += dy;
      }
    };

    scrollCanvasToSelected();
    const outerRaf = requestAnimationFrame(() => {
      requestAnimationFrame(scrollCanvasToSelected);
    });
    return () => cancelAnimationFrame(outerRaf);
  }, [selectedInstance?.id, grid.config.logicalWidth, grid.config.logicalHeight]);

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
    <main className={selectedInstance !== null ? "app-shell app-shell-layer-config-open" : "app-shell"}>
      <aside className="sidebar-rail" aria-label="Builder tools">
        <button
          className={activeTab === "grid" ? "sidebar-rail-button sidebar-rail-button-active" : "sidebar-rail-button"}
          type="button"
          aria-label="Grid"
          aria-pressed={activeTab === "grid"}
          onClick={() => setActiveTab("grid")}
        >
          <span data-testid="grid-divider-icon">
            <ComponentIcon iconId="builder-grid" color="currentColor" size={RAIL_TAB_ICON_PX} />
          </span>
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
          <span data-testid="components-rail-icon">
            <ComponentIcon iconId="builder-layers" color="currentColor" size={RAIL_TAB_ICON_PX} />
          </span>
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
          <ComponentBrowseSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onSelectInstance={(id) => selectInstance(id)}
            onDeleteInstance={deleteInstance}
            onStartComponentDrag={startCreateDrag}
            onReorderInstances={reorderInstances}
            gridStrokeColor={gridConfig.strokeColor}
          />
        )}
      </aside>
      <section ref={canvasPanelRef} className="canvas-panel" aria-label="Canvas viewport">
        <GridCanvas
          canvasRef={builderCanvasRef}
          onUserSelectedInstance={(id) => {
            if (id !== null && id !== undefined) {
              setActiveTab("components");
            }
          }}
        />
      </section>
      {selectedInstance ? (
        <aside className="sidebar sidebar-components sidebar-components-config" aria-label="Layer configuration">
          <ComponentConfigSidebar
            instances={instances}
            selectedInstance={selectedInstance}
            onDeleteInstance={deleteInstance}
            onUpdateInstanceProps={updateInstanceProps}
            onStartEndpointPick={startConnectorEndpointPick}
            gridStrokeColor={gridConfig.strokeColor}
          />
        </aside>
      ) : null}
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
