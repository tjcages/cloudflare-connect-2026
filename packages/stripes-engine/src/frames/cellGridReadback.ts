import type { CellGridReadback } from "../engine";

/**
 * Non-blocking cell-grid readback.
 *
 * `readCellGrid` reads straight into a typed array, which stalls the pipeline
 * until the GPU catches up — affordable once in the lab, not once per instance
 * per frame with a page of textures on one shared context. This copies into a
 * pixel-pack buffer instead, fences it, and hands the bytes over on a later
 * frame, so the GPU is never waited on.
 *
 * The copy happens at `request` time, so the render-target pool is free to hand
 * the same cell texture to another instance before the bytes are collected.
 */
export type AsyncCellGridReader = {
  /** Copy the cell grid into the pack buffer unless a copy is already in flight. */
  request(cols: number, rows: number, valuesFbo: WebGLFramebuffer): void;
  /** The finished readback, or null while the GPU is still working on it. */
  poll(): CellGridReadback | null;
  /** Drop an in-flight read and its fence, so a paused overlay leaks nothing. */
  cancel(): void;
  readonly inFlight: boolean;
  dispose(): void;
};

type Pending = { sync: WebGLSync; cols: number; rows: number };

export function createAsyncCellGridReader(gl: WebGL2RenderingContext): AsyncCellGridReader {
  let valueBuffer: WebGLBuffer | null = null;
  let valueBytes = 0;
  let pending: Pending | null = null;

  function bindSized(buffer: WebGLBuffer | null, allocated: number, needed: number): WebGLBuffer | null {
    const target = buffer ?? gl.createBuffer();
    if (!target) return null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, target);
    if (allocated !== needed) gl.bufferData(gl.PIXEL_PACK_BUFFER, needed, gl.STREAM_READ);
    return target;
  }

  function collect(buffer: WebGLBuffer, out: Uint8Array): void {
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
  }

  return {
    get inFlight() {
      return pending !== null;
    },
    request(cols, rows, valuesFbo) {
      if (pending || cols <= 0 || rows <= 0) return;
      const needed = cols * rows * 4;

      valueBuffer = bindSized(valueBuffer, valueBytes, needed);
      if (!valueBuffer) return;
      valueBytes = needed;
      gl.bindFramebuffer(gl.FRAMEBUFFER, valuesFbo);
      gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, 0);

      // A bound pack buffer redirects every later readPixels, so it never
      // outlives this call — `readOutputPixels` reads into a typed array.
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) return;
      // Without a flush the fence can sit unsubmitted, and a zero-timeout wait
      // on it then never signals.
      gl.flush();
      pending = { sync, cols, rows };
    },
    poll() {
      if (!pending) return null;
      const status = gl.clientWaitSync(pending.sync, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) return null;
      const { cols, rows } = pending;
      gl.deleteSync(pending.sync);
      pending = null;
      if (status === gl.WAIT_FAILED || !valueBuffer) return null;

      const packed = new Uint8Array(cols * rows * 4);
      collect(valueBuffer, packed);
      const values = new Uint8Array(cols * rows);
      for (let index = 0; index < values.length; index++) values[index] = packed[index * 4];

      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return { cols, rows, values, colors: null };
    },
    cancel() {
      if (!pending) return;
      gl.deleteSync(pending.sync);
      pending = null;
    },
    dispose() {
      if (pending) {
        gl.deleteSync(pending.sync);
        pending = null;
      }
      if (valueBuffer) gl.deleteBuffer(valueBuffer);
      valueBuffer = null;
      valueBytes = 0;
    },
  };
}
