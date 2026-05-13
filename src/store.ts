import type { Application } from "pixi.js";
import { create } from "zustand";
import { createComponentInstance, getComponentDefinition, snapComponentPosition } from "./components/componentRegistry";
import { DEFAULT_CONFIG, updateLargeRatio, updateSmallRatio } from "./grid/config";
import { generateGrid } from "./grid/generator";
import type { ComponentInstance, ComponentType, GeneratedGrid, GridConfig, IconBoxProps } from "./grid/types";
import type { CanvasDragState } from "./types/document";

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
};

const createSeed = () => {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().slice(0, 8);
  }

  return `seed-${Date.now()}`;
};

const initialGrid = generateGrid(DEFAULT_CONFIG);

const initialInstances: ComponentInstance[] = [
  createComponentInstance("icon-box", 0, 0, 1, initialGrid.config.logicalWidth, initialGrid.config.logicalHeight),
];

export const useAppStore = create<AppStoreState>((set, get) => ({
  pixiApp: null,
  gridConfig: DEFAULT_CONFIG,
  grid: initialGrid,
  instances: initialInstances,
  selectedInstanceId: null,
  dragState: null,
  nextInstanceIndex: 2,

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
      instances: [...instances, instance],
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
}));
