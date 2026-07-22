import { describe, expect, it } from "vitest";
import { steppedTransportTime, transportRepeatDelayMs } from "./TimeTransport";

describe("TimeTransport", () => {
  it("accelerates repeated stepping the longer the control is held", () => {
    expect(transportRepeatDelayMs(0)).toBe(170);
    expect(transportRepeatDelayMs(1000)).toBe(100);
    expect(transportRepeatDelayMs(2000)).toBe(55);
  });

  it("steps in exact seconds and does not rewind before zero", () => {
    expect(steppedTransportTime(4.25, 1)).toBe(5.25);
    expect(steppedTransportTime(4.25, -1)).toBe(3.25);
    expect(steppedTransportTime(0.25, -1)).toBe(0);
  });
});
