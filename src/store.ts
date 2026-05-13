import type { Application } from "pixi.js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createComponentInstance, getComponentDefinition, snapComponentPosition } from "./components/componentRegistry";
import { updateLargeRatio, updateSmallRatio } from "./grid/config";
import { generateGrid } from "./grid/generator";
import type { ComponentInstance, ComponentType, GeneratedGrid, GridConfig, IconBoxProps } from "./grid/types";
import { getDefaultDocumentSlice, mergePersistedDocument } from "./storePersist";
import type { CanvasDragState } from "./types/document";

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
  instances: ComponentInstance[];
  selectedInstanceId: string | null;
  dragState: CanvasDragState | null;
  nextInstanceIndex: number;
  setPixiApp: (app: Application | null) => void;

  updateGridConfig: (patch: Partial<GridConfig>) => void;
  replaceGridConfig: (gridConfig: GridConfig) => void;
  setSmallRatio: (value: number) => void;
  setLargeRatio: (value: number) => void;
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
  updateInstanceProps: (id: string, props: IconBoxProps) => void;
  reorderInstances: (orderedIds: string[]) => void;
};

const createSeed = () => {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return `seed-${Date.now()}`;
};

const defaultDocument = getDefaultDocumentSlice();

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      pixiApp: null,
      ...defaultDocument,
      dragState: null,

      setPixiApp: (app) => set({ pixiApp: app }),

      updateGridConfig: (patch) =>
        set((s) => {
          const gridConfig = { ...s.gridConfig, ...patch };
          return { gridConfig, grid: generateGrid(gridConfig) };
        }),

      replaceGridConfig: (gridConfig) =>
        set(() => ({
          gridConfig,
          grid: generateGrid(gridConfig),
        })),

      setSmallRatio: (value) =>
        set((s) => {
          const gridConfig = { ...s.gridConfig, ...updateSmallRatio(value) };
          return { gridConfig, grid: generateGrid(gridConfig) };
        }),

      setLargeRatio: (value) =>
        set((s) => {
          const gridConfig = { ...s.gridConfig, ...updateLargeRatio(value) };
          return { gridConfig, grid: generateGrid(gridConfig) };
        }),

      regenerateSeed: () =>
        set((s) => {
          const gridConfig = { ...s.gridConfig, seed: createSeed() };
          return { gridConfig, grid: generateGrid(gridConfig) };
        }),

      selectInstance: (id) => set({ selectedInstanceId: id }),

      startCreateDrag: (type, initialPointer) =>
        set({
          dragState: {
            mode: "create",
            type,
            preview: null,
            ghostClient: initialPointer ? { x: initialPointer.clientX, y: initialPointer.clientY } : null,
          },
        }),

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
        const position = snapComponentPosition(x, y, grid.config.logicalWidth, grid.config.logicalHeight, type);
        const preview: ComponentInstance = {
          id: `${type}-preview`,
          type,
          name: definition.label,
          ...position,
          props: { ...definition.defaultProps },
        };

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
          instances: [instance, ...instances],
          selectedInstanceId: instance.id,
          nextInstanceIndex: nextInstanceIndex + 1,
          dragState: null,
        });
      },

      startMoveDrag: (id, offsetX, offsetY) => {
        set({
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

            return {
              ...instance,
              ...snapComponentPosition(x, y, grid.config.logicalWidth, grid.config.logicalHeight, instance.type),
            };
          }),
        }));
      },

      endCanvasDrag: () => {
        set({ dragState: null });
      },

      deleteInstance: (id) =>
        set((s) => ({
          instances: s.instances.filter((i) => i.id !== id),
          selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId,
        })),

      updateInstanceProps: (id, props) =>
        set((s) => ({
          instances: s.instances.map((instance) => (instance.id === id ? { ...instance, props } : instance)),
        })),

      reorderInstances: (orderedIds) =>
        set((s) => {
          const next = reorderInstancesByIds(s.instances, orderedIds);
          if (next === s.instances) {
            return {};
          }
          return { instances: next };
        }),
    }),
    {
      name: "section-grid-builder",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        gridConfig: state.gridConfig,
        instances: state.instances,
        nextInstanceIndex: state.nextInstanceIndex,
        selectedInstanceId: state.selectedInstanceId,
      }),
      migrate: (persistedState, fromVersion) => migratePersistedPartializeForLayerOrder(fromVersion, persistedState),
      merge: (persisted, current) => mergePersistedDocument(persisted, current),
    },
  ),
);

/** Restore the canvas document to defaults (keeps the Pixi app handle if already set). Intended for tests. */
export const resetAppStoreDocumentToDefault = () => {
  const fresh = getDefaultDocumentSlice();
  useAppStore.setState((s) => ({
    ...fresh,
    pixiApp: s.pixiApp,
    dragState: null,
  }));
};
