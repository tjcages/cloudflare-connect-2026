import type { Application } from "pixi.js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { temporal } from "zundo";
import {
  createComponentInstance,
  getComponentDefinition,
  snapComponentPosition,
  snapConnectorCellCenter,
} from "./lib/componentRegistry";
import { isIconBoxInstance } from "./lib/icon-box/layout";
import { updateSmallRatio } from "./grid/config";
import { scheduleGridFromConfig } from "./store/gridGeneration";
import type {
  ComponentInstance,
  ComponentProps,
  ComponentType,
  ConnectorLineProps,
  GeneratedGrid,
  GridConfig,
  IconBoxEnabledByLineMode,
  IconBoxProps,
  PlusMarkerProps,
  RectMarkerProps,
} from "./grid/types";
import { getDefaultDocumentSlice, mergePersistedDocument } from "./storePersist";
import type { PersistedDocumentSlice } from "./storePersist";
import type { CanvasDragState, ConnectorEndpointPickState } from "./types/document";

/** Ephemeral canvas coordinator snapshot for sidebar debug (not persisted). */
export type IconBoxLineEnableDebugRow = {
  boxId: string;
  hitCount: number;
  onceLatched: boolean;
  visualEnabled: boolean;
  logicalEnabled: boolean;
  colorBusy: boolean;
  hasHandles: boolean;
  mode: IconBoxEnabledByLineMode;
  outgoingActive: number;
  outgoingWaiting: number;
  updatedAt: number;
};

export function reorderInstancesByIds(previous: ComponentInstance[], orderedIds: string[]): ComponentInstance[] {
  if (orderedIds.length !== previous.length) {
    return previous;
  }

  const prevSorted = [...previous.map((i) => i.id)].sort();
  const nextSorted = [...orderedIds].sort();
  if (prevSorted.length !== nextSorted.length || prevSorted.some((id, i) => id !== nextSorted[i])) {
    return previous;
  }

  const byId = new Map(previous.map((i) => [i.id, i]));
  return orderedIds.map((id) => byId.get(id)!);
}

export function migratePersistedPartializeForLayerOrder(fromVersion: number, persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== "object") {
    return persistedState;
  }

  if (fromVersion >= 2 || !Array.isArray((persistedState as { instances?: unknown }).instances)) {
    return persistedState;
  }

  const snapshot = persistedState as { instances: ComponentInstance[] };
  return { ...snapshot, instances: [...snapshot.instances].reverse() };
}

export type AppStoreState = {
  pixiApp: Application | null;
  gridConfig: GridConfig;
  grid: GeneratedGrid;
  /** True while a debounced/worker grid regen is in flight (interactive edits only). */
  gridGenerationPending: boolean;
  instances: ComponentInstance[];
  selectedInstanceId: string | null;
  /** Builder-only CSS-pixel pan applied to the canvas shell (persisted; PNG export ignores). */
  canvasPan: { x: number; y: number };
  /** Builder-only zoom for the canvas shell (session-only; resets on full reload). */
  canvasZoom: number;
  dragState: CanvasDragState | null;
  connectorEndpointPick: ConnectorEndpointPickState | null;
  /** Canvas highlight for a layer hovered in the sidebar (layers list or connector dropdown). */
  sidebarHoveredLayerId: string | null;
  /** Canvas highlight for the layer under the pointer on the canvas (not persisted). */
  canvasHoveredLayerId: string | null;
  nextInstanceIndex: number;
  setPixiApp: (app: Application | null) => void;

  translateCanvasPan: (dx: number, dy: number) => void;
  resetCanvasPan: () => void;
  /** Zoom → 100% and clear pan so the canvas stays visible (pan is scaled with zoom; leaving it causes off-screen layout). */
  resetCanvasZoom: () => void;

  updateGridConfig: (patch: Partial<GridConfig>) => void;
  replaceGridConfig: (gridConfig: GridConfig) => void;
  setSmallRatio: (value: number) => void;
  regenerateSeed: () => void;

  selectInstance: (id: string | null) => void;

  startCreateDrag: (type: ComponentType, initialPointer?: { clientX: number; clientY: number }) => void;
  /** Clear Pixi placement preview and attach the sidebar-style ghost at screen coords (off canvas). */
  revertCreatePreviewToGhost: (clientX: number, clientY: number) => void;
  updateCreatePreview: (type: ComponentType, x: number, y: number) => void;
  finalizeCreateAt: (type: ComponentType, x: number, y: number) => void;

  startMoveDrag: (id: string, offsetX: number, offsetY: number) => void;
  moveInstanceTo: (id: string, x: number, y: number) => void;

  endCanvasDrag: () => void;

  deleteInstance: (id: string) => void;
  duplicateSelectedInstance: () => void;
  updateInstanceProps: (id: string, props: ComponentProps) => void;
  reorderInstances: (orderedIds: string[]) => void;
  undoDocument: () => void;
  redoDocument: () => void;
  startConnectorEndpointPick: (connectorId: string, endpoint: "source" | "target") => void;
  cancelConnectorEndpointPick: () => void;
  setConnectorEndpointHoverCell: (x: number, y: number) => void;
  clearConnectorEndpointHoverCell: () => void;
  setConnectorEndpointCell: (x: number, y: number) => void;
  setSidebarHoveredLayerId: (id: string | null) => void;
  setCanvasHoveredLayerId: (id: string | null) => void;
  /** Ephemeral: icon-box line-enable coordinator mirror for debugging (not persisted). */
  iconBoxLineEnableDebug: Record<string, IconBoxLineEnableDebugRow>;
  patchIconBoxLineEnableDebug: (boxId: string, row: IconBoxLineEnableDebugRow | null) => void;
  clearIconBoxLineEnableDebug: () => void;
  /** Replace document from a persisted snapshot (same shape as zustand `partialize`). Clears undo history and ephemeral UI. */
  applyBuilderDocumentSnapshot: (snapshot: unknown) => void;
};

const createSeed = () => {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return `seed-${Date.now()}`;
};

const defaultDocument = getDefaultDocumentSlice();
const DUPLICATE_OFFSET_PX = 40;

const getDocumentHistorySlice = (state: AppStoreState): PersistedDocumentSlice => ({
  gridConfig: state.gridConfig,
  instances: state.instances,
  nextInstanceIndex: state.nextInstanceIndex,
  selectedInstanceId: state.selectedInstanceId,
});

const documentSlicesAreEqual = (past: PersistedDocumentSlice, current: PersistedDocumentSlice) =>
  JSON.stringify(past) === JSON.stringify(current);

/** Document slice at move-drag start; used with zundo `pause` so intermediate `moveInstanceTo` calls batch into one undo step. */
let moveDragHistoryBaseline: PersistedDocumentSlice | null = null;

type TemporalHandleSet = (
  pastState: PersistedDocumentSlice,
  replace: undefined,
  currentState: PersistedDocumentSlice,
  deltaState?: PersistedDocumentSlice | null,
) => void;

const flushMoveDragHistoryBatch = (baseline: PersistedDocumentSlice) => {
  const temporal = useAppStore.temporal.getState();
  temporal.resume();
  const endSlice = getDocumentHistorySlice(useAppStore.getState());
  if (documentSlicesAreEqual(baseline, endSlice)) {
    return;
  }
  const handleSet = (temporal as { _handleSet?: TemporalHandleSet })._handleSet;
  handleSet?.(baseline, undefined, endSlice, undefined);
};

const gridScheduleHandlers = {
  onPending: () => useAppStore.setState({ gridGenerationPending: true }),
  onComplete: (grid: GeneratedGrid) => useAppStore.setState({ grid, gridGenerationPending: false }),
  onError: () => useAppStore.setState({ gridGenerationPending: false }),
};

const syncGridToCurrentConfig = () => {
  scheduleGridFromConfig(useAppStore.getState().gridConfig, gridScheduleHandlers, { immediate: true });
};

const scheduleGridConfigUpdate = (gridConfig: GridConfig, immediate = false) => {
  useAppStore.setState({ gridConfig });
  scheduleGridFromConfig(gridConfig, gridScheduleHandlers, { immediate });
};

const duplicateInstanceForGrid = (
  instance: ComponentInstance,
  index: number,
  gridConfig: GeneratedGrid["config"],
): ComponentInstance => {
  const definition = getComponentDefinition(instance.type);
  const id = `${instance.type}-${index}`;
  const name = `${definition.label} ${index}`;

  if (instance.type === "connector-line") {
    return {
      ...instance,
      id,
      name,
      props: { ...instance.props },
    };
  }

  const position = snapComponentPosition(
    instance.x + DUPLICATE_OFFSET_PX,
    instance.y + DUPLICATE_OFFSET_PX,
    gridConfig.logicalWidth,
    gridConfig.logicalHeight,
    instance.type,
  );

  if (isIconBoxInstance(instance)) {
    return {
      ...instance,
      id,
      name,
      ...position,
      props: { ...instance.props },
    };
  }

  return {
    ...instance,
    id,
    name,
    ...position,
    props: { ...instance.props },
  };
};

export const useAppStore = create<AppStoreState>()(
  persist(
    temporal(
      (set, get) => ({
        pixiApp: null,
        ...defaultDocument,
        gridGenerationPending: false,
        canvasPan: { x: 0, y: 0 },
        canvasZoom: 1,
        dragState: null,
        connectorEndpointPick: null,
        sidebarHoveredLayerId: null,
        canvasHoveredLayerId: null,
        iconBoxLineEnableDebug: {},

        setPixiApp: (app) => set({ pixiApp: app }),

        translateCanvasPan: (dx, dy) =>
          set((s) => ({
            canvasPan: { x: s.canvasPan.x + dx, y: s.canvasPan.y + dy },
          })),
        resetCanvasPan: () => set({ canvasPan: { x: 0, y: 0 } }),
        resetCanvasZoom: () => set({ canvasZoom: 1, canvasPan: { x: 0, y: 0 } }),

        updateGridConfig: (patch) => {
          const gridConfig = { ...get().gridConfig, ...patch };
          scheduleGridConfigUpdate(gridConfig);
        },

        replaceGridConfig: (gridConfig) => {
          scheduleGridConfigUpdate(gridConfig, true);
        },

        setSmallRatio: (value) => {
          const gridConfig = { ...get().gridConfig, ...updateSmallRatio(value) };
          scheduleGridConfigUpdate(gridConfig);
        },

        regenerateSeed: () => {
          const gridConfig = { ...get().gridConfig, seed: createSeed() };
          scheduleGridConfigUpdate(gridConfig, true);
        },

        selectInstance: (id) => set({ selectedInstanceId: id }),

        startCreateDrag: (type, initialPointer) => {
          moveDragHistoryBaseline = null;
          if (!useAppStore.temporal.getState().isTracking) {
            useAppStore.temporal.getState().resume();
          }
          set({
            canvasHoveredLayerId: null,
            dragState: {
              mode: "create",
              type,
              preview: null,
              ghostClient: initialPointer ? { x: initialPointer.clientX, y: initialPointer.clientY } : null,
            },
          });
        },

        revertCreatePreviewToGhost: (clientX, clientY) =>
          set((s) => {
            const d = s.dragState;
            if (d?.mode !== "create") {
              return {};
            }
            return {
              dragState: { ...d, preview: null, ghostClient: { x: clientX, y: clientY } },
            };
          }),

        updateCreatePreview: (type, x, y) => {
          const { grid } = get();
          const definition = getComponentDefinition(type);
          const created = createComponentInstance(type, x, y, 0, grid.config.logicalWidth, grid.config.logicalHeight);
          const preview: ComponentInstance = { ...created, id: `${type}-preview`, name: definition.label };

          set({
            dragState: { mode: "create", type, preview, ghostClient: null },
          });
        },

        finalizeCreateAt: (type, x, y) => {
          const { grid, nextInstanceIndex, instances } = get();
          const instance = createComponentInstance(
            type,
            x,
            y,
            nextInstanceIndex,
            grid.config.logicalWidth,
            grid.config.logicalHeight,
          );
          set({
            instances: type === "connector-line" ? [...instances, instance] : [instance, ...instances],
            selectedInstanceId: instance.id,
            nextInstanceIndex: nextInstanceIndex + 1,
            dragState: null,
          });
        },

        startMoveDrag: (id, offsetX, offsetY) => {
          moveDragHistoryBaseline = getDocumentHistorySlice(get());
          useAppStore.temporal.getState().pause();
          set({
            canvasHoveredLayerId: null,
            dragState: { mode: "move", id, offsetX, offsetY },
          });
        },

        moveInstanceTo: (id, x, y) => {
          const { grid } = get();
          set((s) => ({
            instances: s.instances.map((instance) => {
              if (instance.id !== id) {
                return instance;
              }
              if (instance.type === "connector-line") {
                return instance;
              }

              return {
                ...instance,
                ...snapComponentPosition(x, y, grid.config.logicalWidth, grid.config.logicalHeight, instance.type),
              };
            }),
          }));
        },

        endCanvasDrag: () => {
          const dragState = get().dragState;
          if (dragState === null) {
            return;
          }
          const wasMove = dragState.mode === "move";
          set({ dragState: null });

          if (wasMove) {
            const baseline = moveDragHistoryBaseline;
            moveDragHistoryBaseline = null;
            if (baseline !== null) {
              flushMoveDragHistoryBatch(baseline);
            } else {
              useAppStore.temporal.getState().resume();
            }
            return;
          }

          moveDragHistoryBaseline = null;
          const temporal = useAppStore.temporal.getState();
          if (!temporal.isTracking) {
            temporal.resume();
          }
        },

        deleteInstance: (id) =>
          set((s) => ({
            instances: s.instances.filter((i) => i.id !== id),
            selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId,
          })),

        duplicateSelectedInstance: () =>
          set((s) => {
            const selectedIndex = s.instances.findIndex((instance) => instance.id === s.selectedInstanceId);
            if (selectedIndex === -1) {
              return {};
            }

            const selected = s.instances[selectedIndex];
            const duplicate = duplicateInstanceForGrid(selected, s.nextInstanceIndex, s.grid.config);
            const instances =
              duplicate.type === "connector-line"
                ? [...s.instances, duplicate]
                : [...s.instances.slice(0, selectedIndex), duplicate, ...s.instances.slice(selectedIndex)];

            return {
              instances,
              selectedInstanceId: duplicate.id,
              nextInstanceIndex: s.nextInstanceIndex + 1,
            };
          }),

        updateInstanceProps: (id, props) =>
          set((s) => ({
            instances: s.instances.map((instance) => {
              if (instance.id !== id) {
                return instance;
              }
              if (isIconBoxInstance(instance) && "iconId" in props) {
                const newProps = props as IconBoxProps;
                const layoutChanged =
                  newProps.length !== instance.props.length || newProps.direction !== instance.props.direction;
                if (layoutChanged) {
                  const snapped = snapComponentPosition(
                    instance.x,
                    instance.y,
                    s.grid.config.logicalWidth,
                    s.grid.config.logicalHeight,
                    "icon-box",
                    newProps,
                  );
                  return { ...instance, x: snapped.x, y: snapped.y, props: newProps };
                }
                return { ...instance, props: newProps };
              }
              if (instance.type === "plus-marker") {
                return { ...instance, props: { ...instance.props, ...props } as PlusMarkerProps };
              }
              if (instance.type === "rect-marker") {
                return { ...instance, props: { ...instance.props, ...props } as RectMarkerProps };
              }
              if (instance.type === "connector-line") {
                return { ...instance, props: { ...instance.props, ...props } as ConnectorLineProps };
              }
              return instance;
            }),
          })),

        reorderInstances: (orderedIds) =>
          set((s) => {
            const next = reorderInstancesByIds(s.instances, orderedIds);
            if (next === s.instances) {
              return {};
            }
            return { instances: next };
          }),

        undoDocument: () => {
          useAppStore.temporal.getState().undo();
          syncGridToCurrentConfig();
        },

        redoDocument: () => {
          useAppStore.temporal.getState().redo();
          syncGridToCurrentConfig();
        },

        startConnectorEndpointPick: (connectorId, endpoint) =>
          set((s) => {
            const connector = s.instances.find(
              (instance) => instance.id === connectorId && instance.type === "connector-line",
            );
            if (!connector) {
              return {};
            }
            return {
              canvasHoveredLayerId: null,
              connectorEndpointPick: { connectorId, endpoint, hoverCell: null },
            };
          }),

        cancelConnectorEndpointPick: () => set({ connectorEndpointPick: null }),

        setConnectorEndpointHoverCell: (x, y) =>
          set((s) => {
            const pick = s.connectorEndpointPick;
            if (!pick) {
              return {};
            }
            const hoverCell = snapConnectorCellCenter(x, y, s.grid.config.logicalWidth, s.grid.config.logicalHeight);
            return { connectorEndpointPick: { ...pick, hoverCell } };
          }),

        clearConnectorEndpointHoverCell: () =>
          set((s) => {
            const pick = s.connectorEndpointPick;
            if (!pick || pick.hoverCell === null) {
              return {};
            }
            return { connectorEndpointPick: { ...pick, hoverCell: null } };
          }),

        setConnectorEndpointCell: (x, y) =>
          set((s) => {
            const pick = s.connectorEndpointPick;
            if (!pick) {
              return {};
            }
            const cell = snapConnectorCellCenter(x, y, s.grid.config.logicalWidth, s.grid.config.logicalHeight);
            return {
              connectorEndpointPick: null,
              instances: s.instances.map((instance) => {
                if (instance.id !== pick.connectorId || instance.type !== "connector-line") {
                  return instance;
                }
                return {
                  ...instance,
                  x: pick.endpoint === "source" ? cell.x : instance.x,
                  y: pick.endpoint === "source" ? cell.y : instance.y,
                  props: {
                    ...instance.props,
                    [pick.endpoint]: { kind: "cell", ...cell },
                  },
                };
              }),
            };
          }),

        setSidebarHoveredLayerId: (id) => set({ sidebarHoveredLayerId: id }),
        setCanvasHoveredLayerId: (id) => set({ canvasHoveredLayerId: id }),

        patchIconBoxLineEnableDebug: (boxId, row) =>
          set((s) => {
            const next = { ...s.iconBoxLineEnableDebug };
            if (row === null) {
              delete next[boxId];
            } else {
              next[boxId] = row;
            }
            return { iconBoxLineEnableDebug: next };
          }),

        clearIconBoxLineEnableDebug: () => set({ iconBoxLineEnableDebug: {} }),

        applyBuilderDocumentSnapshot: (snapshot) => {
          moveDragHistoryBaseline = null;
          const temporalStore = useAppStore.temporal.getState();
          temporalStore.pause();
          useAppStore.setState((s) => {
            const merged = mergePersistedDocument(snapshot, s);
            return {
              ...merged,
              dragState: null,
              connectorEndpointPick: null,
              sidebarHoveredLayerId: null,
              canvasHoveredLayerId: null,
              iconBoxLineEnableDebug: {},
            };
          });
          temporalStore.clear();
          temporalStore.resume();
        },
      }),
      {
        partialize: getDocumentHistorySlice,
        equality: documentSlicesAreEqual,
      },
    ),
    {
      name: "section-grid-builder",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        gridConfig: state.gridConfig,
        instances: state.instances,
        nextInstanceIndex: state.nextInstanceIndex,
        selectedInstanceId: state.selectedInstanceId,
        canvasPan: state.canvasPan,
      }),
      migrate: (persistedState, fromVersion) => migratePersistedPartializeForLayerOrder(fromVersion, persistedState),
      merge: (persisted, current) => mergePersistedDocument(persisted, current),
    },
  ),
);

/** Restore the canvas document to defaults (keeps the Pixi app handle if already set). Intended for tests. */
export const resetAppStoreDocumentToDefault = () => {
  moveDragHistoryBaseline = null;
  const fresh = getDefaultDocumentSlice();
  const temporalStore = useAppStore.temporal.getState();
  temporalStore.pause();
  useAppStore.setState((s) => ({
    ...fresh,
    pixiApp: s.pixiApp,
    canvasPan: { x: 0, y: 0 },
    canvasZoom: 1,
    gridGenerationPending: false,
    dragState: null,
    connectorEndpointPick: null,
    sidebarHoveredLayerId: null,
    canvasHoveredLayerId: null,
    iconBoxLineEnableDebug: {},
  }));
  temporalStore.clear();
  temporalStore.resume();
};
