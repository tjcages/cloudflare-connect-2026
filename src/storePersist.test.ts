import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./grid/config";
import type { ComponentInstance } from "./grid/types";
import { DEFAULT_ICON_ID } from "./lib/iconRegistry";
import { createComponentInstance, snapConnectorCellCenter } from "./lib/componentRegistry";
import type { AppStoreState } from "./store";
import { getDefaultDocumentSlice, mergePersistedDocument } from "./storePersist";

const minimalStoreForMerge = (): Pick<
  AppStoreState,
  "gridConfig" | "grid" | "instances" | "nextInstanceIndex" | "selectedInstanceId"
> &
  Record<string, unknown> => {
  const fresh = getDefaultDocumentSlice();
  return {
    ...fresh,
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

    expect(merged.instances).toEqual([connector]);
    expect(merged.selectedInstanceId).toBe("connector-line-7");
    expect(merged.nextInstanceIndex).toBe(8);
  });
});
