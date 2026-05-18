import { describe, expect, it } from "vitest";
import {
  createOutgoingPulseGateState,
  releaseOutgoingPulseSlot,
  tryAcquireOutgoingPulseSlot,
} from "./iconBoxOutgoingPulseGate";

const ordered = ["a", "b", "c"];

describe("iconBoxOutgoingPulseGate", () => {
  it("grants up to budget and promotes waiting in stable order", () => {
    let gate = createOutgoingPulseGateState();
    let r = tryAcquireOutgoingPulseSlot(ordered, 1, "a", gate);
    expect(r.granted).toBe(true);
    gate = r.state;

    r = tryAcquireOutgoingPulseSlot(ordered, 1, "b", gate);
    expect(r.granted).toBe(false);
    gate = r.state;

    gate = releaseOutgoingPulseSlot(ordered, 1, "a", gate);
    r = tryAcquireOutgoingPulseSlot(ordered, 1, "b", gate);
    expect(r.granted).toBe(true);
    gate = r.state;

    expect(gate.active.has("b")).toBe(true);
    expect(gate.waiting.size).toBe(0);
  });

  it("idempotent acquire for active connector", () => {
    let gate = createOutgoingPulseGateState();
    let r = tryAcquireOutgoingPulseSlot(ordered, 2, "a", gate);
    gate = r.state;
    r = tryAcquireOutgoingPulseSlot(ordered, 2, "a", gate);
    expect(r.granted).toBe(true);
    expect(r.state.active.size).toBe(1);
  });
});
