import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
  type PostHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { FAULT_FIELD_FRAG, FAULT_POST_FRAG } from "./fault-slip.shaders";

const MAX_EVENTS = 3;
const STEPS_PER_DIR = 5;
const SEGS_PER_EVENT = 10;
const PROP_SEC = 0.35;
const EVENT_MS = 5400;
const INTRO_DELAY_MS = 700;
const IDLE_TIME = 1e4;
const TAU = Math.PI * 2;

interface FaultSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  t1: number;
  w0: number;
  w1: number;
}

interface FaultEvent {
  cx: number;
  cy: number;
  radius: number;
  peak: number;
  creepSec: number;
  phase: number;
  segments: FaultSegment[];
  startMs: number | null;
}

interface FaultUniforms {
  count: WebGLUniformLocation | null;
  bounds: WebGLUniformLocation | null;
  meta: WebGLUniformLocation | null;
  segs: WebGLUniformLocation | null;
  params: WebGLUniformLocation | null;
}

function buildEvent(x: number, y: number, sc: number, rng: () => number): FaultEvent {
  const segments: FaultSegment[] = [];
  const baseAngle = rng() * TAU;
  const taper = 1 / STEPS_PER_DIR;
  let maxDist = 0;
  let maxRun = 1;

  for (let d = 0; d < 2; d++) {
    let angle = baseAngle + d * Math.PI + (rng() - 0.5) * 0.14;
    let px = x;
    let py = y;
    let run = 0;
    for (let i = 0; i < STEPS_PER_DIR; i++) {
      angle += (rng() - 0.5) * 0.32;
      const len = (44 + 18 * rng()) * sc;
      const nx = px + Math.cos(angle) * len;
      const ny = py + Math.sin(angle) * len;
      const w0 = 1 - i * taper;
      segments.push({ x0: px, y0: py, x1: nx, y1: ny, t0: run, t1: run + len, w0, w1: w0 - taper });
      run += len;
      px = nx;
      py = ny;
      maxDist = Math.max(maxDist, Math.hypot(nx - x, ny - y));
    }
    maxRun = Math.max(maxRun, run);
  }

  for (const seg of segments) {
    seg.t0 = (seg.t0 / maxRun) * PROP_SEC;
    seg.t1 = (seg.t1 / maxRun) * PROP_SEC;
  }

  return {
    cx: x,
    cy: y,
    radius: maxDist + 90 * sc,
    peak: 0.86 + 0.28 * rng(),
    creepSec: 2.5 + 1.5 * rng(),
    phase: rng(),
    segments,
    startMs: null,
  };
}

const definition: ExperimentDefinition = {
  id: "fault-slip",
  title: "Fault Slip",
  category: "click",
  blurb:
    "Click opens a long fault: the field shears along it, offsetting the stripes, then creeps back into alignment.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260731);
    const events: FaultEvent[] = [];
    const packed = {
      count: 0,
      bounds: new Float32Array(MAX_EVENTS * 4),
      meta: new Float32Array(MAX_EVENTS * 4),
      segs: new Float32Array(MAX_EVENTS * SEGS_PER_EVENT * 4),
      params: new Float32Array(MAX_EVENTS * SEGS_PER_EVENT * 4),
    };

    const packEvents = (now: number) => {
      let write = 0;
      for (const event of events) {
        if (event.startMs === null) event.startMs = now;
        if (now - event.startMs <= EVENT_MS) events[write++] = event;
      }
      events.length = write;

      let count = 0;
      for (const event of events) {
        if (count >= MAX_EVENTS) break;
        const age = (now - (event.startMs ?? now)) / 1000;
        packed.bounds[count * 4] = event.cx;
        packed.bounds[count * 4 + 1] = event.cy;
        packed.bounds[count * 4 + 2] = event.radius;
        packed.bounds[count * 4 + 3] = age;
        packed.meta[count * 4] = event.peak;
        packed.meta[count * 4 + 1] = event.creepSec;
        packed.meta[count * 4 + 2] = event.phase;
        packed.meta[count * 4 + 3] = 0;
        for (let j = 0; j < SEGS_PER_EVENT; j++) {
          const base = (count * SEGS_PER_EVENT + j) * 4;
          const seg = event.segments[j];
          if (!seg) {
            packed.params[base] = IDLE_TIME;
            packed.params[base + 1] = IDLE_TIME;
            packed.params[base + 2] = 0;
            packed.params[base + 3] = 0;
            continue;
          }
          packed.segs[base] = seg.x0;
          packed.segs[base + 1] = seg.y0;
          packed.segs[base + 2] = seg.x1;
          packed.segs[base + 3] = seg.y1;
          packed.params[base] = seg.t0;
          packed.params[base + 1] = seg.t1;
          packed.params[base + 2] = seg.w0;
          packed.params[base + 3] = seg.w1;
        }
        count++;
      }
      packed.count = count;
    };

    const spawn = (x: number, y: number) => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      const sc = Math.min(2.5, Math.max(0.5, Math.min(w, h) / 300));
      if (events.length >= MAX_EVENTS) events.shift();
      events.push(buildEvent(x, y, sc, rng));
    };

    const onDown = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      spawn((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    };
    ctx.canvas.addEventListener("pointerdown", onDown);

    const bindArrays = (gl: WebGL2RenderingContext, program: WebGLProgram): FaultUniforms => ({
      count: gl.getUniformLocation(program, "uEventCount"),
      bounds: gl.getUniformLocation(program, "uEventBounds"),
      meta: gl.getUniformLocation(program, "uEventMeta"),
      segs: gl.getUniformLocation(program, "uSeg"),
      params: gl.getUniformLocation(program, "uSegT"),
    });

    const uploadArrays = (gl: WebGL2RenderingContext, arrays: FaultUniforms) => {
      gl.uniform1i(arrays.count, packed.count);
      gl.uniform4fv(arrays.bounds, packed.bounds);
      gl.uniform4fv(arrays.meta, packed.meta);
      gl.uniform4fv(arrays.segs, packed.segs);
      gl.uniform4fv(arrays.params, packed.params);
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, FAULT_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const arrays = bindArrays(gl, program);
      return {
        render(frame) {
          packEvents(frame.now);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          uploadArrays(gl, arrays);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, FAULT_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const arrays = bindArrays(gl, program);
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          uploadArrays(gl, arrays);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass, postPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
    });

    const replay = () => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      spawn(w * (0.28 + 0.44 * rng()), h * (0.3 + 0.4 * rng()));
    };

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();
    const introTimer = window.setTimeout(replay, INTRO_DELAY_MS);

    return {
      engine,
      replay,
      destroy: () => {
        disposed = true;
        window.clearTimeout(introTimer);
        ctx.canvas.removeEventListener("pointerdown", onDown);
        engine.dispose();
      },
    };
  },
};

export default definition;
