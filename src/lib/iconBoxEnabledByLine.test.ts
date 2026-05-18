import { describe, expect, it } from "vitest";
import {
  applyHitToLineEnableState,
  iconBoxOutgoingBudget,
  initialIconBoxLineEnableCounters,
  isIconBoxLayerConnectorTarget,
  lineEnablePresentationEnabled,
  listOutgoingConnectorsFromLayerSource,
} from "./iconBoxEnabledByLine";
import type { ComponentInstance } from "../grid/types";

const connectorTargeting = (targetId: string): ComponentInstance => ({
  id: "c1",
  type: "connector-line",
  name: "C",
  x: 0,
  y: 0,
  props: {
    preferredConnection: "horizontal",
    source: { kind: "cell", x: 40, y: 40 },
    target: { kind: "layer", instanceId: targetId },
    overlayGrid: true,
    animated: true,
  },
});

const connectorFromLayerSource = (id: string, sourceId: string): ComponentInstance => ({
  id,
  type: "connector-line",
  name: "C",
  x: 0,
  y: 0,
  props: {
    preferredConnection: "horizontal",
    source: { kind: "layer", instanceId: sourceId },
    target: { kind: "cell", x: 120, y: 40 },
    overlayGrid: true,
    animated: true,
  },
});

const iconBox = (id: string): Extract<ComponentInstance, { type: "icon-box" }> => ({
  id,
  type: "icon-box",
  name: "I",
  x: 0,
  y: 0,
  props: {
    matchCornersWithTheme: false,
    theme: "purple",
    iconId: "section-mark",
    title: "T",
    containerHighlighted: false,
    enabledByLine: "iterated",
  },
});

describe("iconBoxEnabledByLine", () => {
  it("detects layer connector targets", () => {
    const instances = [iconBox("b1"), connectorTargeting("b1")] as ComponentInstance[];
    expect(isIconBoxLayerConnectorTarget(instances, "b1")).toBe(true);
    expect(isIconBoxLayerConnectorTarget(instances, "missing")).toBe(false);
  });

  it("lists outgoing connectors in instance order", () => {
    const instances = [
      connectorFromLayerSource("c2", "b1"),
      iconBox("b1"),
      connectorFromLayerSource("c3", "b1"),
    ] as ComponentInstance[];
    expect(listOutgoingConnectorsFromLayerSource(instances, "b1")).toEqual(["c2", "c3"]);
  });

  it("iterated hitCount increments on forward target hit; decrement is coordinator-driven (pulse cycle end)", () => {
    let s = initialIconBoxLineEnableCounters();
    s = applyHitToLineEnableState("iterated", s, "forward");
    expect(lineEnablePresentationEnabled("iterated", s)).toBe(true);
    expect(iconBoxOutgoingBudget("iterated", true, s)).toBe(1);
    s = applyHitToLineEnableState("iterated", s, "backward");
    expect(lineEnablePresentationEnabled("iterated", s)).toBe(true);
    s = { ...s, hitCount: Math.max(0, s.hitCount - 1) };
    expect(lineEnablePresentationEnabled("iterated", s)).toBe(false);
    expect(iconBoxOutgoingBudget("iterated", false, s)).toBe(0);
  });

  it("once mode latches on forward hit only", () => {
    let s = initialIconBoxLineEnableCounters();
    expect(lineEnablePresentationEnabled("once", s)).toBe(false);
    s = applyHitToLineEnableState("once", s, "forward");
    expect(lineEnablePresentationEnabled("once", s)).toBe(true);
    s = applyHitToLineEnableState("once", s, "backward");
    expect(lineEnablePresentationEnabled("once", s)).toBe(true);
  });
});
