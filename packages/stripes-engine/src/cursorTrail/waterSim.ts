import { createPingPong, type PingPong } from "../gl/pingPong";
import { bindRenderTarget } from "../gl/renderTarget";
import { createWaterSimPass } from "../passes/waterSimPass";

/** Sim runs at half display resolution, capped on the long edge. */
const RESOLUTION_DIVISOR = 2;
const MAX_SIM_EDGE = 420;
/** Sub-steps per frame. Wave speed is a function of this, not of frame time. */
const SUBSTEPS = 15;
const SPLAT_RADIUS = 7;
const SPLAT_AMP_PER_STEP = 0.5;
/** Speed (display px/frame) -> splat amplitude. */
const SPEED_TO_AMP = 0.12;
/** After the cursor leaves, one last release pulse decaying over this window. */
const EXIT_RELEASE_MS = 400;
const EXIT_RELEASE_AMP = 0.45;
/** Stop stepping once the surface has had this long with no input. */
const FREEZE_AFTER_IDLE_MS = 6000;
const FIELD_GAIN = 1.65;
/** Time constant for the host-facing activity value, seconds. */
const ACTIVITY_TAU = 0.5;

export type WaterSimCursor = { x: number; y: number } | null;

export type WaterSimTexture = {
  texture: WebGLTexture;
  gain: number;
  texelX: number;
  texelY: number;
};

export type WaterSim = {
  /**
   * Advance the surface one frame. `cursor` is in display pixels with a
   * top-left origin; pass null when the pointer is outside the canvas.
   */
  tick(nowMs: number, cursor: WaterSimCursor, displayWidth: number, displayHeight: number): void;
  /** Null while the surface is at rest, so the field pass can skip the coupling. */
  current(): WaterSimTexture | null;
  /** 0..1 eased measure of how much the surface is moving. */
  activity(): number;
  /**
   * Drop the host-facing activity value to 0 without touching the heightfield.
   * Called when the engine pauses: the frozen value would otherwise be reported
   * again on resume, after the idle freeze has already pulled the ripples out of
   * the render.
   */
  resetActivity(): void;
  dispose(): void;
};

export function createWaterSim(gl: WebGL2RenderingContext, quad: { draw(): void }): WaterSim {
  const pass = createWaterSimPass(gl, quad);
  let pingPong: PingPong | null = null;
  let simWidth = 0;
  let simHeight = 0;
  let texture: WebGLTexture | null = null;
  let disabled = false;

  let lastSplatMs = -Infinity;
  let hadCursor = false;
  let prevX = 0;
  let prevY = 0;
  let exitMs = -Infinity;
  let exitX = 0;
  let exitY = 0;

  let activityValue = 0;
  let lastTickMs = -1;

  function clear(): void {
    if (!pingPong) return;
    for (const rt of [pingPong.read(), pingPong.write()]) {
      bindRenderTarget(gl, rt);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function step(
    nowMs: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    amp: number,
    w: number,
    h: number,
  ): void {
    if (disabled) {
      texture = null;
      return;
    }
    if (amp !== 0) lastSplatMs = nowMs;
    // Surface at rest: hold the last texture out of the pipeline entirely.
    if (nowMs - lastSplatMs > FREEZE_AFTER_IDLE_MS) {
      texture = null;
      return;
    }

    let sw = Math.max(1, Math.round(w / RESOLUTION_DIVISOR));
    let sh = Math.max(1, Math.round(h / RESOLUTION_DIVISOR));
    const longEdge = Math.max(sw, sh);
    if (longEdge > MAX_SIM_EDGE) {
      const k = MAX_SIM_EDGE / longEdge;
      sw = Math.max(1, Math.round(sw * k));
      sh = Math.max(1, Math.round(sh * k));
    }

    try {
      if (!pingPong) {
        if (!gl.getExtension("EXT_color_buffer_float")) {
          throw new Error("EXT_color_buffer_float unavailable");
        }
        pingPong = createPingPong(gl, sw, sh, { float: true, linear: true });
        simWidth = sw;
        simHeight = sh;
        clear();
      } else if (sw !== simWidth || sh !== simHeight) {
        pingPong.resize(sw, sh);
        simWidth = sw;
        simHeight = sh;
        clear();
      }

      // Display coords are top-left origin; the sim samples GL-style.
      const sax = amp !== 0 ? (ax / Math.max(1, w)) * sw : 0;
      const say = amp !== 0 ? ((h - ay) / Math.max(1, h)) * sh : 0;
      const sbx = amp !== 0 ? (bx / Math.max(1, w)) * sw : 0;
      const sby = amp !== 0 ? ((h - by) / Math.max(1, h)) * sh : 0;

      for (let i = 0; i < SUBSTEPS; i++) {
        // Spread this frame's cursor travel across the sub-steps, so a fast
        // stroke lays down a continuous wake instead of discrete blobs.
        const t0 = i / SUBSTEPS;
        const t1 = (i + 1) / SUBSTEPS;
        pass.render(pingPong.write(), pingPong.read(), {
          texelX: 1 / sw,
          texelY: 1 / sh,
          ax: sax + (sbx - sax) * t0,
          ay: say + (sby - say) * t0,
          bx: sax + (sbx - sax) * t1,
          by: say + (sby - say) * t1,
          amp: amp * SPLAT_AMP_PER_STEP,
          radius: SPLAT_RADIUS,
        });
        pingPong.swap();
      }
      texture = pingPong.read().texture;
    } catch (error) {
      disabled = true;
      texture = null;
      console.warn("[stripes-engine] water sim disabled:", error);
    }
  }

  return {
    tick(nowMs, cursor, displayWidth, displayHeight) {
      const dt = lastTickMs < 0 ? 0 : Math.max(0, Math.min(0.1, (nowMs - lastTickMs) / 1000));
      lastTickMs = nowMs;

      let amp = 0;
      let ax = 0;
      let ay = 0;
      let bx = 0;
      let by = 0;

      if (cursor) {
        bx = cursor.x;
        by = cursor.y;
        ax = hadCursor ? prevX : bx;
        ay = hadCursor ? prevY : by;
        const speed = hadCursor ? Math.hypot(bx - ax, by - ay) : 0;
        prevX = bx;
        prevY = by;
        hadCursor = true;
        amp = Math.min(1, speed * SPEED_TO_AMP);
      } else {
        if (hadCursor) {
          exitMs = nowMs;
          exitX = prevX;
          exitY = prevY;
        }
        hadCursor = false;
        const t = (nowMs - exitMs) / EXIT_RELEASE_MS;
        if (t >= 0 && t < 1) {
          const e = 1 - t;
          amp = EXIT_RELEASE_AMP * e * e;
          ax = bx = exitX;
          ay = by = exitY;
        }
      }

      const target = amp !== 0 ? Math.min(1, Math.abs(amp) * 3.2) : 0;
      activityValue += (target - activityValue) * (1 - Math.exp(-dt / ACTIVITY_TAU));

      step(nowMs, ax, ay, bx, by, amp, displayWidth, displayHeight);
    },
    current() {
      if (!texture || simWidth === 0 || simHeight === 0) return null;
      return { texture, gain: FIELD_GAIN, texelX: 1 / simWidth, texelY: 1 / simHeight };
    },
    resetActivity() {
      activityValue = 0;
    },
    activity() {
      return activityValue;
    },
    dispose() {
      pass.dispose();
      pingPong?.dispose();
      pingPong = null;
      texture = null;
    },
  };
}
