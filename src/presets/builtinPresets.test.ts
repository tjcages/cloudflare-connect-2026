import { describe, expect, it, beforeEach } from "vitest";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { BUILTIN_PRESETS } from "./builtinPresets";

describe("builtinPresets", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
  });

  it("apply Crowded, 3 colors preset sets density, seed, and three themed icon boxes (2x1 + 1x1 + 1x1)", () => {
    const preset = BUILTIN_PRESETS.find((p) => p.id === "crowded-3-colors-2x1-1x1");
    expect(preset).toBeDefined();

    useAppStore.getState().applyBuilderDocumentSnapshot(preset!.snapshot);

    const { gridConfig, instances } = useAppStore.getState();
    expect(gridConfig.density).toBe(0.52);
    expect(gridConfig.seed).toBe("preset-crowded-3c");
    expect(instances).toHaveLength(3);

    expect(instances.map((i) => i.type)).toEqual(["icon-box-2x1", "icon-box", "icon-box"]);

    const themes = instances.map((i) => (i.type === "icon-box" || i.type === "icon-box-2x1" ? i.props.theme : null));
    expect(themes).toEqual(["blue", "orange", "purple"]);
  });
});
