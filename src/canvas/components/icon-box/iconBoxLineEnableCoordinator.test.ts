import { beforeEach, describe, expect, it } from "vitest";
import type { ComponentInstance } from "../../../grid/types";
import { resetAppStoreDocumentToDefault, useAppStore } from "../../../store";
import { iconBoxLineEnableCoordinator } from "./iconBoxLineEnableCoordinator";

const iconBox = (id: string): Extract<ComponentInstance, { type: "icon-box" }> => ({
  id,
  type: "icon-box",
  name: "Box",
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

const connectorCellToLayer = (id: string, targetId: string): ComponentInstance => ({
  id,
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

const connectorLayerToSameLayer = (id: string, boxId: string): ComponentInstance => ({
  id,
  type: "connector-line",
  name: "C",
  x: 0,
  y: 0,
  props: {
    preferredConnection: "horizontal",
    source: { kind: "layer", instanceId: boxId },
    target: { kind: "layer", instanceId: boxId },
    overlayGrid: true,
    animated: true,
  },
});

describe("iconBoxLineEnableCoordinator", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
    iconBoxLineEnableCoordinator._resetAllForTests();
  });

  it("decrements iterated hitCount when forward delivery completes at the layer target (cell → layer)", () => {
    const box = iconBox("b1");
    const conn = connectorCellToLayer("c1", "b1");
    useAppStore.setState({ instances: [box, conn] });

    iconBoxLineEnableCoordinator.notifyTargetHit({ connectorId: "c1", boxId: "b1" });
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(1);

    iconBoxLineEnableCoordinator.notifyTargetLayerPulseCycleComplete({
      connectorId: "c1",
      targetLayerId: "b1",
    });
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(0);
  });

  it("does not decrement target-layer cycle when source is a layer on the same box (outgoing owns the cycle)", () => {
    const box = iconBox("b1");
    const conn = connectorLayerToSameLayer("c1", "b1");
    useAppStore.setState({ instances: [box, conn] });

    iconBoxLineEnableCoordinator.notifyTargetHit({ connectorId: "c1", boxId: "b1" });
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(1);

    iconBoxLineEnableCoordinator.notifyTargetLayerPulseCycleComplete({
      connectorId: "c1",
      targetLayerId: "b1",
    });
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(1);

    iconBoxLineEnableCoordinator.notifyOutgoingCycleComplete("b1");
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(0);
  });

  it("notifyOutgoingCycleComplete uses the same iterated decrement path", () => {
    const box = iconBox("b1");
    const conn = connectorCellToLayer("c1", "b1");
    useAppStore.setState({ instances: [box, conn] });

    iconBoxLineEnableCoordinator.notifyTargetHit({ connectorId: "c1", boxId: "b1" });
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(1);

    iconBoxLineEnableCoordinator.notifyOutgoingCycleComplete("b1");
    expect(iconBoxLineEnableCoordinator._getCounters("b1")?.hitCount).toBe(0);
  });
});
