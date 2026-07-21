import { serpentinePoint } from "./revealMath";
import { createPingPong, type PingPong } from "../gl/pingPong";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { createWaterSimPass } from "../passes/waterSimPass";
import { compileProgram } from "../gl/program";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { WATER_REVEAL_ACCUM_FRAG } from "../shaders/waterRevealAccum.frag";

/** Sim runs at half display resolution, capped on the long edge (matches cursorTrail/waterSim.ts). */
const RESOLUTION_DIVISOR = 2;
const MAX_SIM_EDGE = 420;
/** Sub-steps per frame. Wave speed is a function of this, not of frame time. */
const SUBSTEPS = 15;
const SPLAT_AMP_PER_STEP = 0.5;
/** Half-alpha height for the water's compressive alpha curve crest/(crest+K).
 * Shared by the reveal pass and the cover accumulator so the reveal always
 * matches how white the water looks. Measured crests run 4 (p90) to 25 (max),
 * so this sits mid-range: strong water reads bright without ever clipping to a
 * flat white plateau. */
export const WATER_WHITE_K = 3;
/** How much white the water adds on top of the field. Bounded well under 1 so
 * water tints the image instead of blowing it out. */
export const WATER_GLOW = 0.72;
/** Reveal saturates faster than the glow: water that is clearly present should
 * finish a pixel off, while still only tinting it. Nothing else reveals — there
 * is no end-of-animation fill — so this has to be generous enough that the
 * sweep plus the settle ring-down carry the whole image on their own. */
const WATER_REVEAL_K = 0.3;
/** Per-frame cover gained by water that keeps washing a pixel. This is what
 * finishes the image, so it must outlast the animation: sustained water
 * completes a pixel, a single faint ripple does not. */
const WATER_SOAK = 0.045;

export type WaterRevealTextures = {
  height: WebGLTexture;
  cover: WebGLTexture;
  texelX: number;
  texelY: number;
};

export type WaterRevealSim = {
  tick(p: {
    sweepT: number;
    displayWidth: number;
    displayHeight: number;
    rows: number;
    wobble: number;
    intensity: number;
    softness: number;
  }): void;
  current(): WaterRevealTextures | null;
  release(): void;
  dispose(): void;
};

export function createWaterRevealSim(gl: WebGL2RenderingContext, quad: { draw(): void }): WaterRevealSim {
  const heightPass = createWaterSimPass(gl, quad);
  const accumProgram = compileProgram(gl, FULLSCREEN_VERT, WATER_REVEAL_ACCUM_FRAG);
  const u = (n: string) => gl.getUniformLocation(accumProgram, n);
  const L = {
    prevCover: u("uPrevCover"),
    height: u("uHeight"),
    revealK: u("uRevealK"),
    gamma: u("uGamma"),
    soak: u("uSoak"),
  };

  let heightPingPong: PingPong | null = null;
  let coverPingPong: PingPong | null = null;
  let simWidth = 0;
  let simHeight = 0;
  let disabled = false;
  let hasTicked = false;

  let lastSweepT = -Infinity;
  let prevPointValid = false;
  let prevSX = 0;
  let prevSY = 0;

  function clearRT(rt: RenderTarget): void {
    bindRenderTarget(gl, rt);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function clearHeight(): void {
    if (!heightPingPong) return;
    clearRT(heightPingPong.read());
    clearRT(heightPingPong.write());
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function clearCover(): void {
    if (!coverPingPong) return;
    clearRT(coverPingPong.read());
    clearRT(coverPingPong.write());
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Cover is UV-sampled only (never at sim texel offsets), so unlike height it doesn't need to track sim dims. */
  function clearAll(): void {
    clearHeight();
    clearCover();
  }

  function accumulate(softness: number): void {
    if (!heightPingPong || !coverPingPong) return;
    const gamma = 0.8 - 0.45 * Math.min(1, Math.max(0, softness));
    bindRenderTarget(gl, coverPingPong.write());
    gl.useProgram(accumProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, coverPingPong.read().texture);
    gl.uniform1i(L.prevCover, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, heightPingPong.read().texture);
    gl.uniform1i(L.height, 1);
    gl.uniform1f(L.revealK, WATER_REVEAL_K);
    gl.uniform1f(L.gamma, gamma);
    gl.uniform1f(L.soak, WATER_SOAK);
    quad.draw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    coverPingPong.swap();
  }

  return {
    tick(p) {
      if (disabled) return;

      if (p.sweepT < lastSweepT) {
        clearAll();
        prevPointValid = false;
      }
      lastSweepT = p.sweepT;

      let sw = Math.max(1, Math.round(p.displayWidth / RESOLUTION_DIVISOR));
      let sh = Math.max(1, Math.round(p.displayHeight / RESOLUTION_DIVISOR));
      const longEdge = Math.max(sw, sh);
      if (longEdge > MAX_SIM_EDGE) {
        const k = MAX_SIM_EDGE / longEdge;
        sw = Math.max(1, Math.round(sw * k));
        sh = Math.max(1, Math.round(sh * k));
      }

      try {
        if (!heightPingPong || !coverPingPong) {
          if (!gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("EXT_color_buffer_float unavailable");
          }
          heightPingPong = createPingPong(gl, sw, sh, { float: true, linear: true });
          coverPingPong = createPingPong(gl, sw, sh, { linear: true });
          simWidth = sw;
          simHeight = sh;
          clearAll();
        } else if (sw !== simWidth || sh !== simHeight) {
          heightPingPong.resize(sw, sh);
          simWidth = sw;
          simHeight = sh;
          clearHeight();
        }

        let sx = prevSX;
        let sy = prevSY;
        let amp = 0;
        if (p.sweepT < 1) {
          const pt = serpentinePoint(p.sweepT, p.rows, p.wobble);
          sx = pt.x * sw;
          sy = (1 - pt.y) * sh;
          amp = p.intensity * SPLAT_AMP_PER_STEP;
        }

        if (!prevPointValid) {
          prevSX = sx;
          prevSY = sy;
          prevPointValid = true;
        }

        const radius = Math.max(3, sh / (Math.max(1, p.rows) * 2.6));

        for (let i = 0; i < SUBSTEPS; i++) {
          const t0 = i / SUBSTEPS;
          const t1 = (i + 1) / SUBSTEPS;
          heightPass.render(heightPingPong.write(), heightPingPong.read(), {
            texelX: 1 / sw,
            texelY: 1 / sh,
            ax: prevSX + (sx - prevSX) * t0,
            ay: prevSY + (sy - prevSY) * t0,
            bx: prevSX + (sx - prevSX) * t1,
            by: prevSY + (sy - prevSY) * t1,
            amp,
            radius,
          });
          heightPingPong.swap();
        }
        prevSX = sx;
        prevSY = sy;

        accumulate(p.softness);

        hasTicked = true;
      } catch (error) {
        disabled = true;
        console.warn("[stripes-engine] water reveal sim disabled:", error);
      }
    },
    current() {
      if (disabled || !hasTicked || !heightPingPong || !coverPingPong) return null;
      return {
        height: heightPingPong.read().texture,
        cover: coverPingPong.read().texture,
        texelX: 1 / simWidth,
        texelY: 1 / simHeight,
      };
    },
    release() {
      heightPingPong?.dispose();
      coverPingPong?.dispose();
      heightPingPong = null;
      coverPingPong = null;
      simWidth = 0;
      simHeight = 0;
      hasTicked = false;
      lastSweepT = -Infinity;
      prevPointValid = false;
      prevSX = 0;
      prevSY = 0;
    },
    dispose() {
      heightPass.dispose();
      gl.deleteProgram(accumProgram);
      heightPingPong?.dispose();
      coverPingPong?.dispose();
      heightPingPong = null;
      coverPingPong = null;
    },
  };
}
