import { afterEach, describe, expect, it, vi } from "vitest";
import { applyLevaPatch, createLevaPatchWriter, diffLevaPatch, levaValuesEqual } from "./levaStoreWrite";

describe("levaStoreWrite", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("treats hex case as equal so Color knobs cannot ping-pong", () => {
    expect(levaValuesEqual("#FEA700", "#fea700")).toBe(true);
    expect(levaValuesEqual("#fea700", "fea700")).toBe(true);
    expect(levaValuesEqual("Rain", "rain")).toBe(false);
  });

  it("drops keys that already match the live store", () => {
    expect(
      diffLevaPatch(
        { twizzlerColor: "#fea700", twizzlerTwist: 4, stripeColorsTable: "a|b" },
        { twizzlerColor: "#FEA700", twizzlerTwist: 4, stripeColorsTable: "a|c" },
      ),
    ).toEqual({ stripeColorsTable: "a|c" });
  });

  it("retries per key when Leva set() throws on a missing mapped path", () => {
    const applied: Record<string, unknown>[] = [];
    const setter = (patch: Record<string, unknown>) => {
      if ("missing" in patch) throw new Error("mappedPaths.missing is undefined");
      applied.push(patch);
    };
    applyLevaPatch(setter, { twizzlerTwist: 2, missing: true });
    expect(applied).toEqual([{ twizzlerTwist: 2 }]);
  });

  it("coalesces rapid writes to one setter call per frame (CF-68)", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames[id - 1] = () => {};
    });

    const current: Record<string, unknown> = { twizzlerTwist: 1, twizzlerSpeed: 2 };
    const setter = vi.fn();
    const writer = createLevaPatchWriter({
      getSetter: () => setter,
      getCurrent: () => current,
    });

    writer.write({ twizzlerTwist: 3 });
    writer.write({ twizzlerTwist: 4, twizzlerSpeed: 2 });
    expect(setter).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);

    frames[0]!(0);
    expect(setter).toHaveBeenCalledTimes(1);
    expect(setter).toHaveBeenCalledWith({ twizzlerTwist: 4 });
  });

  it("skips a flush when the coalesced patch matches the store", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const setter = vi.fn();
    const writer = createLevaPatchWriter({
      getSetter: () => setter,
      getCurrent: () => ({ twizzlerColor: "#fea700" }),
    });
    writer.write({ twizzlerColor: "#FEA700" });
    frames[0]!(0);
    expect(setter).not.toHaveBeenCalled();
  });
});
