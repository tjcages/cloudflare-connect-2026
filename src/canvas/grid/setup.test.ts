import { describe, expect, it, vi } from "vitest";
import { setupGridLayer } from "./setup";
import { generateGrid } from "../../grid/generator";
import { DEFAULT_CONFIG } from "../../grid/config";
import { useAppStore } from "../../store";

describe("setupGridLayer", () => {
  it("caches the grid graphics as a texture and refreshes it after grid changes", () => {
    const cleanupFns: Array<() => void> = [];
    const addedChildren: unknown[] = [];
    const app = {
      stage: {
        addChildAt: vi.fn((child: unknown) => {
          addedChildren.push(child);
        }),
      },
    };

    setupGridLayer({
      app: app as unknown as Parameters<typeof setupGridLayer>[0]["app"],
      cleanup: (fn) => cleanupFns.push(fn),
    });

    const graphics = addedChildren[0] as {
      isCachedAsTexture: boolean;
      updateCacheTexture: () => void;
    };
    const updateCacheTexture = vi.spyOn(graphics, "updateCacheTexture");

    expect(graphics.isCachedAsTexture).toBe(true);
    expect(updateCacheTexture).toHaveBeenCalledTimes(0);

    useAppStore.setState({
      grid: generateGrid({ ...DEFAULT_CONFIG, seed: "grid-cache-test" }),
    });

    expect(updateCacheTexture).toHaveBeenCalledTimes(1);

    cleanupFns.forEach((fn) => fn());
  });
});
