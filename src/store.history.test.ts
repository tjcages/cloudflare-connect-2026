import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./grid/config";
import type { ComponentInstance } from "./grid/types";
import { DEFAULT_ICON_ID } from "./lib/iconRegistry";
import { resetAppStoreDocumentToDefault, useAppStore } from "./store";

const iconBoxInstance = (id: string, title: string): ComponentInstance => ({
  id,
  type: "icon-box",
  name: "Icon Box",
  x: 40,
  y: 80,
  props: {
    matchCornersWithTheme: false,
    theme: "purple",
    iconId: DEFAULT_ICON_ID,
    title,
    containerHighlighted: false,
    enabledByLine: "off",
  },
});

describe("document history", () => {
  it("undoes and redoes grid config changes while keeping the generated grid in sync", () => {
    resetAppStoreDocumentToDefault();

    useAppStore.getState().updateGridConfig({ strokeColor: "#ff0000" });
    expect(useAppStore.getState().gridConfig.strokeColor).toBe("#ff0000");
    expect(useAppStore.getState().grid.config.strokeColor).toBe("#ff0000");

    useAppStore.getState().undoDocument();
    expect(useAppStore.getState().gridConfig.strokeColor).toBe(DEFAULT_CONFIG.strokeColor);
    expect(useAppStore.getState().grid.config.strokeColor).toBe(DEFAULT_CONFIG.strokeColor);

    useAppStore.getState().redoDocument();
    expect(useAppStore.getState().gridConfig.strokeColor).toBe("#ff0000");
    expect(useAppStore.getState().grid.config.strokeColor).toBe("#ff0000");
  });

  it("duplicates the selected layer as a new selected document action", () => {
    resetAppStoreDocumentToDefault();
    const inst = iconBoxInstance("icon-box-4", "Workers");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id, nextInstanceIndex: 5 });

    useAppStore.getState().duplicateSelectedInstance();

    expect(useAppStore.getState().instances.map((item) => item.id)).toEqual(["icon-box-5", "icon-box-4"]);
    expect(useAppStore.getState().selectedInstanceId).toBe("icon-box-5");
    expect(useAppStore.getState().nextInstanceIndex).toBe(6);
    expect(useAppStore.getState().instances[0]).toMatchObject({
      type: "icon-box",
      props: inst.props,
    });
    expect(useAppStore.getState().instances[0].name).toBe("Icon Box 5");
  });

  it("does not track ephemeral drag state in document history", () => {
    resetAppStoreDocumentToDefault();
    const before = useAppStore.getState().gridConfig;

    useAppStore.getState().startCreateDrag("icon-box");
    useAppStore.getState().undoDocument();

    expect(useAppStore.getState().gridConfig).toBe(before);
    expect(useAppStore.getState().dragState).not.toBeNull();
  });

  it("batches a canvas move drag into one undo step", () => {
    resetAppStoreDocumentToDefault();
    const inst = iconBoxInstance("icon-box-move-batch", "Batch");
    useAppStore.setState({ instances: [inst], selectedInstanceId: inst.id, nextInstanceIndex: 2 });

    const pastBefore = useAppStore.temporal.getState().pastStates.length;
    useAppStore.getState().startMoveDrag(inst.id, 0, 0);
    useAppStore.getState().moveInstanceTo(inst.id, 200, 200);
    useAppStore.getState().moveInstanceTo(inst.id, 320, 240);
    useAppStore.getState().endCanvasDrag();

    expect(useAppStore.temporal.getState().pastStates.length - pastBefore).toBe(1);
    expect(useAppStore.temporal.getState().isTracking).toBe(true);

    useAppStore.getState().undoDocument();
    const restored = useAppStore.getState().instances.find((i) => i.id === inst.id);
    expect(restored?.x).toBe(inst.x);
    expect(restored?.y).toBe(inst.y);
  });
});
