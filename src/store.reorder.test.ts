import { describe, expect, it } from "vitest";
import { DEFAULT_ICON_ID } from "./components/iconRegistry";
import type { ComponentInstance } from "./grid/types";
import { migratePersistedPartializeForLayerOrder, reorderInstancesByIds } from "./store";

const stubInstance = (id: string): ComponentInstance => ({
  id,
  type: "icon-box",
  name: id,
  x: 0,
  y: 0,
  props: {
    matchCornersWithTheme: false,
    theme: "purple",
    iconId: DEFAULT_ICON_ID,
    title: "",
    containerHighlighted: false,
  },
});

describe("reorderInstancesByIds", () => {
  it("reorders instances when orderedIds is a valid permutation", () => {
    const a = stubInstance("icon-box-1");
    const b = stubInstance("icon-box-2");
    const c = stubInstance("icon-box-3");

    expect(reorderInstancesByIds([a, b, c], ["icon-box-3", "icon-box-1", "icon-box-2"])).toEqual([c, a, b]);
  });

  it("no-ops when length differs", () => {
    const list = [stubInstance("icon-box-1")];
    expect(reorderInstancesByIds(list, ["a", "b"])).toBe(list);
  });

  it("no-ops when id multiset does not match", () => {
    const list = [stubInstance("icon-box-1"), stubInstance("icon-box-2")];
    expect(reorderInstancesByIds(list, ["icon-box-2", "wrong"])).toBe(list);
  });
});

describe("migratePersistedPartializeForLayerOrder", () => {
  it("reverses instances when fromVersion is below 2", () => {
    const payload = { instances: [{ id: "bottom" }, { id: "top" }], gridConfig: {}, nextInstanceIndex: 2 };
    const result = migratePersistedPartializeForLayerOrder(1, payload) as typeof payload;
    expect(result.instances.map((i: { id: string }) => i.id)).toEqual(["top", "bottom"]);
  });

  it("leaves payload unchanged from v2", () => {
    const payload = { instances: [{ id: "a" }, { id: "b" }] };
    expect(migratePersistedPartializeForLayerOrder(2, payload)).toBe(payload);
  });
});
