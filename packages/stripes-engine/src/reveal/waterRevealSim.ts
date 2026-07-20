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

export type WaterRevealTextures = {
  height: WebGLTexture;
  cover: WebGLTexture;
  texelX: number;
  texelY: number;
};

export type WaterRevealSim = {
  tick(p: {
    sweepT: number;
    settleT: number;
    displayWidth: number;
    displayHeight: number;
    rows: number;
    wobble: number;
    intensity: number;
    softness: number;
  }): void;
  current(): WaterRevealTextures | null;
  dispose(): void;
};

function smoothstep01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export function createWaterRevealSim(gl: WebGL2RenderingContext, quad: { draw(): void }): WaterRevealSim {
  const heightPass = createWaterSimPass(gl, quad);
  const accumProgram = compileProgram(gl, FULLSCREEN_VERT, WATER_REVEAL_ACCUM_FRAG);
  const u = (n: string) => gl.getUniformLocation(accumProgram, n);
  const L = {
    prevCover: u("uPrevCover"),
    height: u("uHeight"),
    threshLo: u("uThreshLo"),
    threshHi: u("uThreshHi"),
    fillFloor: u("uFillFloor"),
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

  function clearAll(): void {
    if (!heightPingPong || !coverPingPong) return;
    clearRT(heightPingPong.read());
    clearRT(heightPingPong.write());
    clearRT(coverPingPong.read());
    clearRT(coverPingPong.write());
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function accumulate(settleT: number, softness: number): void {
    if (!heightPingPong || !coverPingPong) return;
    const threshLo = 0.015;
    const threshHi = 0.015 + Math.max(0.01, softness * 0.25);
    const fillFloor = smoothstep01((settleT - 0.35) / 0.55);
    bindRenderTarget(gl, coverPingPong.write());
    gl.useProgram(accumProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, coverPingPong.read().texture);
    gl.uniform1i(L.prevCover, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, heightPingPong.read().texture);
    gl.uniform1i(L.height, 1);
    gl.uniform1f(L.threshLo, threshLo);
    gl.uniform1f(L.threshHi, threshHi);
    gl.uniform1f(L.fillFloor, fillFloor);
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
          coverPingPong.resize(sw, sh);
          simWidth = sw;
          simHeight = sh;
          clearAll();
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

        const radius = Math.max(3, sh / (Math.max(1, p.rows) * 2.2));

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

        accumulate(p.settleT, p.softness);

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
