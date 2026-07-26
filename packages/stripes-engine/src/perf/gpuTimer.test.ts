import { describe, expect, it, vi } from "vitest";
import { createGpuTimer } from "./gpuTimer";

function fakeGl(): { gl: WebGL2RenderingContext; getExtension: ReturnType<typeof vi.fn> } {
  const getExtension = vi.fn(() => ({ TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }));
  return { gl: { getExtension } as unknown as WebGL2RenderingContext, getExtension };
}

describe("gpu timer", () => {
  it("collects timings when enabled", () => {
    const { gl, getExtension } = fakeGl();
    expect(createGpuTimer(gl).supported).toBe(true);
    expect(getExtension).toHaveBeenCalledWith("EXT_disjoint_timer_query_webgl2");
  });

  it("never touches the context when disabled, so no query readback can stall a frame", () => {
    const { gl, getExtension } = fakeGl();
    const timer = createGpuTimer(gl, false);

    timer.begin("field");
    timer.end();
    timer.poll();

    expect(timer.supported).toBe(false);
    expect(timer.latest()).toEqual({});
    expect(getExtension).not.toHaveBeenCalled();
  });
});
