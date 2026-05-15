import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./grid/config";
import type { ComponentInstance } from "./grid/types";
import { DEFAULT_ICON_ID } from "./lib/iconRegistry";
import { createComponentInstance, snapConnectorCellCenter } from "./lib/componentRegistry";
import type { AppStoreState } from "./store";
import { getDefaultDocumentSlice, mergePersistedDocument } from "./storePersist";

const minimalStoreForMerge = (): Pick<
  AppStoreState,
  "gridConfig" | "grid" | "instances" | "nextInstanceIndex" | "selectedInstanceId" | "canvasPan"
> &
  Record<string, unknown> => {
  const fresh = getDefaultDocumentSlice();
  return {
    ...fresh,
    canvasPan: { x: 0, y: 0 },
    dummyAction: () => {},
  };
};

describe("mergePersistedDocument", () => {
  it("returns current state when persisted payload is not an object", () => {
    const current = minimalStoreForMerge();
    expect(mergePersistedDocument(null, current)).toBe(current);
    expect(mergePersistedDocument(42, current)).toBe(current);
  });

  it("returns current state when gridConfig fails validation", () => {
    const current = minimalStoreForMerge();
    expect(mergePersistedDocument({ gridConfig: { seed: "x" } }, current)).toBe(current);
  });

  it("merges a valid persisted snapshot and regenerates the grid", () => {
    const current = minimalStoreForMerge();
    const seedOverride = "persisted-seed";
    const merged = mergePersistedDocument(
      {
        gridConfig: {
          ...DEFAULT_CONFIG,
          seed: seedOverride,
        },
        instances: [],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
      },
      current,
    );

    expect(merged.gridConfig.seed).toBe(seedOverride);
    expect(merged.grid.config.seed).toBe(seedOverride);
    expect(merged.instances).toEqual([]);
    expect(merged.nextInstanceIndex).toBeGreaterThanOrEqual(2);
    expect(merged.dummyAction).toBeDefined();
  });

  it("defaults connectorAnimationEnabled when missing from persisted gridConfig", () => {
    const current = minimalStoreForMerge();
    const { connectorAnimationEnabled: _omit, ...legacyGrid } = DEFAULT_CONFIG;
    const merged = mergePersistedDocument(
      {
        gridConfig: legacyGrid as typeof DEFAULT_CONFIG,
        instances: [],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
      },
      current,
    );

    expect(merged.gridConfig.connectorAnimationEnabled).toBe(true);
    expect(merged.grid.config.connectorAnimationEnabled).toBe(true);
  });

  it("preserves disabled connectorAnimationEnabled from persisted gridConfig", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: { ...DEFAULT_CONFIG, connectorAnimationEnabled: false },
        instances: [],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
      },
      current,
    );

    expect(merged.gridConfig.connectorAnimationEnabled).toBe(false);
    expect(merged.grid.config.connectorAnimationEnabled).toBe(false);
  });

  it("drops selection when the id is not among instances", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: getDefaultDocumentSlice().instances,
        nextInstanceIndex: 2,
        selectedInstanceId: "missing-id",
      },
      current,
    );

    expect(merged.selectedInstanceId).toBeNull();
  });

  it("defaults containerHighlighted when missing from persisted icon-box props", () => {
    const current = minimalStoreForMerge();
    const inst = getDefaultDocumentSlice().instances[0] as Extract<ComponentInstance, { type: "icon-box" }>;
    const { containerHighlighted: _drop, ...propsWithoutHighlight } = inst.props;
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [{ ...inst, props: propsWithoutHighlight }],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
      },
      current,
    );

    expect((merged.instances[0] as Extract<ComponentInstance, { type: "icon-box" }>).props.containerHighlighted).toBe(
      false,
    );
  });

  it("snap-adjusts persisted icon-box coordinates during merge", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [
          {
            id: "icon-box-5",
            type: "icon-box",
            name: "Icon Box 5",
            x: 43,
            y: 79,
            props: {
              matchCornersWithTheme: false,
              theme: "purple",
              iconId: DEFAULT_ICON_ID,
              title: "Hi",
              containerHighlighted: false,
            },
          },
        ],
        nextInstanceIndex: 6,
        selectedInstanceId: "icon-box-5",
      },
      current,
    );

    const ib = merged.instances[0] as Extract<ComponentInstance, { type: "icon-box" }>;
    const logicalWidth = merged.grid.config.logicalWidth;
    const logicalHeight = merged.grid.config.logicalHeight;
    const expected = createComponentInstance("icon-box", 43, 79, 5, logicalWidth, logicalHeight);

    expect(ib.x).toBe(expected.x);
    expect(ib.y).toBe(expected.y);
    expect(merged.selectedInstanceId).toBe("icon-box-5");
  });

  it("snap-adjusts persisted plus-marker coordinates during merge", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [
          {
            id: "plus-marker-6",
            type: "plus-marker",
            name: "Plus Marker 6",
            x: 43,
            y: 79,
            props: { theme: "purple" },
          },
        ],
        nextInstanceIndex: 7,
        selectedInstanceId: "plus-marker-6",
      },
      current,
    );

    const pm = merged.instances[0] as Extract<ComponentInstance, { type: "plus-marker" }>;
    const logicalWidth = merged.grid.config.logicalWidth;
    const logicalHeight = merged.grid.config.logicalHeight;
    const expected = createComponentInstance("plus-marker", 43, 79, 6, logicalWidth, logicalHeight);

    expect(pm.x).toBe(expected.x);
    expect(pm.y).toBe(expected.y);
    expect(pm.props).toEqual({ theme: "purple" });
    expect(merged.selectedInstanceId).toBe("plus-marker-6");
  });

  it("snap-adjusts persisted rect-marker coordinates during merge", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [
          {
            id: "rect-marker-6",
            type: "rect-marker",
            name: "Rect Marker 6",
            x: 43,
            y: 79,
            props: { theme: "purple" },
          },
        ],
        nextInstanceIndex: 7,
        selectedInstanceId: "rect-marker-6",
      },
      current,
    );

    const rm = merged.instances[0] as Extract<ComponentInstance, { type: "rect-marker" }>;
    const logicalWidth = merged.grid.config.logicalWidth;
    const logicalHeight = merged.grid.config.logicalHeight;
    const expected = createComponentInstance("rect-marker", 43, 79, 6, logicalWidth, logicalHeight);

    expect(rm.x).toBe(expected.x);
    expect(rm.y).toBe(expected.y);
    expect(rm.props).toEqual({ theme: "purple" });
    expect(merged.selectedInstanceId).toBe("rect-marker-6");
  });

  it("snap-adjusts persisted connector-line anchors and cell endpoints during merge", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [
          {
            id: "connector-line-3",
            type: "connector-line",
            name: "Connector Line 3",
            x: 43,
            y: 79,
            props: {
              preferredConnection: "horizontal",
              source: { kind: "cell", x: 41, y: 81 },
              target: { kind: "cell", x: 199, y: 41 },
            },
          },
        ],
        nextInstanceIndex: 4,
        selectedInstanceId: null,
      },
      current,
    );

    const c = merged.instances[0] as Extract<ComponentInstance, { type: "connector-line" }>;
    const logicalWidth = merged.grid.config.logicalWidth;
    const logicalHeight = merged.grid.config.logicalHeight;
    const expectedAnchor = createComponentInstance("connector-line", 43, 79, 3, logicalWidth, logicalHeight);

    expect(c.x).toBe(expectedAnchor.x);
    expect(c.y).toBe(expectedAnchor.y);
    expect(c.props.source).toEqual({
      kind: "cell",
      ...snapConnectorCellCenter(41, 81, logicalWidth, logicalHeight),
    });
    expect(c.props.target).toEqual({
      kind: "cell",
      ...snapConnectorCellCenter(199, 41, logicalWidth, logicalHeight),
    });
  });

  it("raises nextInstanceIndex when persisted counter lags behind instance ids", () => {
    const current = minimalStoreForMerge();
    const logicalWidth = current.grid.config.logicalWidth;
    const logicalHeight = current.grid.config.logicalHeight;
    const ib = createComponentInstance("icon-box", 40, 80, 99, logicalWidth, logicalHeight);

    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [ib],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
      },
      current,
    );

    expect(merged.nextInstanceIndex).toBeGreaterThanOrEqual(100);
    expect(merged.instances[0].id).toBe("icon-box-99");
  });

  it("drops persisted instances that fail normalization", () => {
    const current = minimalStoreForMerge();
    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [{ id: "nope", type: "not-a-real-type", name: "x", x: 0, y: 0, props: {} }] as never,
        nextInstanceIndex: 5,
        selectedInstanceId: null,
      },
      current,
    );

    expect(merged.instances).toEqual([]);
    expect(merged.nextInstanceIndex).toBe(5);
  });

  it("preserves persisted connector-line props and selected id", () => {
    const current = minimalStoreForMerge();
    const connector = {
      id: "connector-line-7",
      type: "connector-line",
      name: "Connector Line 7",
      x: 120,
      y: 120,
      props: {
        preferredConnection: "vertical",
        source: { kind: "cell", x: 120, y: 120 },
        target: { kind: "layer", instanceId: "icon-box-1" },
      },
    };

    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [connector],
        nextInstanceIndex: 8,
        selectedInstanceId: "connector-line-7",
      },
      current,
    );

    expect(merged.instances).toEqual([
      { ...connector, props: { ...connector.props, overlayGrid: true, animated: true } },
    ]);
    expect(merged.selectedInstanceId).toBe("connector-line-7");
    expect(merged.nextInstanceIndex).toBe(8);
  });

  it("restores canvasPan from persisted builder viewport", () => {
    const current = minimalStoreForMerge();

    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
        canvasPan: { x: 42, y: -17 },
      },
      current,
    );

    expect(merged.canvasPan).toEqual({ x: 42, y: -17 });
  });

  it("sanitizes invalid persisted canvasPan using current pan", () => {
    const current = minimalStoreForMerge();
    current.canvasPan = { x: 3, y: 4 };

    const merged = mergePersistedDocument(
      {
        gridConfig: DEFAULT_CONFIG,
        instances: [],
        nextInstanceIndex: 2,
        selectedInstanceId: null,
        canvasPan: { x: Number.NaN, y: "nope" },
      },
      current,
    );

    expect(merged.canvasPan).toEqual({ x: 3, y: 4 });
  });
});
