import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./grid/config";
import type { ComponentInstance } from "./grid/types";
import { getDefaultDocumentSlice, mergePersistedDocument } from "./storePersist";
import type { AppStoreState } from "./store";

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
    expect(merged.instances.length).toBeGreaterThan(0);
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
