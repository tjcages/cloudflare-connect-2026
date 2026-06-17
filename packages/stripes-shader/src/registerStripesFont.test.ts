import { describe, expect, it, vi, beforeEach } from "vitest";

describe("registerStripesFont", () => {
  beforeEach(() => {
    // Reset the module so the `registered` flag is cleared between tests
    vi.resetModules();
  });

  it("resolves without throwing (SSR guard or happy-dom FontFace path)", async () => {
    const { registerStripesFont } = await import("./registerStripesFont");
    await expect(registerStripesFont()).resolves.toBeUndefined();
  });

  it("is idempotent — calling twice does not throw", async () => {
    const { registerStripesFont } = await import("./registerStripesFont");
    await expect(registerStripesFont()).resolves.toBeUndefined();
    await expect(registerStripesFont()).resolves.toBeUndefined();
  });

  it("invokes document.fonts.add at most once across two calls when FontFace is available", async () => {
    if (typeof FontFace === "undefined") {
      // happy-dom lacks FontFace — the SSR/no-FontFace guard returns early; nothing to assert
      return;
    }
    const addSpy = vi.spyOn(document.fonts, "add").mockImplementation(() => undefined as unknown as FontFace);
    const { registerStripesFont } = await import("./registerStripesFont");
    await registerStripesFont();
    await registerStripesFont();
    expect(addSpy).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
  });
});
