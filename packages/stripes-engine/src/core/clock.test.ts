import { describe, it, expect } from "vitest";
import { createManualClock } from "./clock";
describe("createManualClock", () => {
  it("set and advance move the clock", () => {
    const c = createManualClock(100);
    expect(c.now()).toBe(100);
    c.advance(16);
    expect(c.now()).toBe(116);
    c.set(0);
    expect(c.now()).toBe(0);
  });
});
