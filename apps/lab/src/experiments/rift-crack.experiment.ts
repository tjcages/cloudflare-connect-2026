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
import { RIFT_FIELD_FRAG, RIFT_POST_FRAG } from "./rift-crack.shaders";

const MAX_EVENTS = 3;
const SEGS_PER_EVENT = 18;
const MAIN_COUNT = 3;
const MAIN_STEPS = 4;
const BRANCH_COUNT = 2;
const BRANCH_STEPS = 3;
const EVENT_MS = 3800;
const INTRO_DELAY_MS = 700;
const TAU = Math.PI * 2;

interface RiftSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  t1: number;
  width: number;
  phase: number;
}

interface RiftEvent {
  cx: number;
  cy: number;
  radius: number;
  segments: RiftSegment[];
  startMs: number | null;
}

interface RiftUniforms {
  count: WebGLUniformLocation | null;
  bounds: WebGLUniformLocation | null;
  segs: WebGLUniformLocation | null;
  params: WebGLUniformLocation | null;
}

interface BranchSeed {
  x: number;
  y: number;
  angle: number;
  time: number;
}

function buildEvent(x: number, y: number, sc: number, rng: () => number): RiftEvent {
  const segments: RiftSegment[] = [];
  const branchSeeds: BranchSeed[] = [];
  const speed = 900 * sc;
  const baseAngle = rng() * TAU;
  let maxDist = 0;

  const emit = (px: number, py: number, nx: number, ny: number, t0: number, t1: number, width: number) => {
    segments.push({ x0: px, y0: py, x1: nx, y1: ny, t0, t1, width, phase: rng() });
    maxDist = Math.max(maxDist, Math.hypot(nx - x, ny - y));
  };

  for (let m = 0; m < MAIN_COUNT; m++) {
    let angle = baseAngle + (m + (rng() - 0.5) * 0.5) * (TAU / MAIN_COUNT);
    let px = x;
    let py = y;
    let time = 0;
    for (let i = 0; i < MAIN_STEPS; i++) {
      angle += (rng() - 0.5) * 0.85;
      const len = (46 + 34 * rng()) * sc * (1 - 0.1 * i);
      const nx = px + Math.cos(angle) * len;
      const ny = py + Math.sin(angle) * len;
      const next = time + len / speed;
      emit(px, py, nx, ny, time, next, 1 - 0.16 * i);
      px = nx;
      py = ny;
      time = next;
      if (i === 1) branchSeeds.push({ x: px, y: py, angle, time });
    }
  }

  const offset = Math.floor(rng() * branchSeeds.length);
  for (let b = 0; b < BRANCH_COUNT; b++) {
    const seed = branchSeeds[(offset + b) % branchSeeds.length];
    if (!seed) break;
    let angle = seed.angle + (rng() < 0.5 ? -1 : 1) * (0.55 + 0.45 * rng());
    let px = seed.x;
    let py = seed.y;
    let time = seed.time;
    for (let i = 0; i < BRANCH_STEPS; i++) {
      angle += (rng() - 0.5) * 0.95;
      const len = (30 + 26 * rng()) * sc * (1 - 0.14 * i);
      const nx = px + Math.cos(angle) * len;
      const ny = py + Math.sin(angle) * len;
      const next = time + len / speed;
      emit(px, py, nx, ny, time, next, 0.52 - 0.12 * i);
      px = nx;
      py = ny;
      time = next;
    }
  }

  return { cx: x, cy: y, radius: maxDist + 150 * sc, segments, startMs: null };
}

const definition: ExperimentDefinition = {
  id: "rift-crack",
  title: "Rift Crack",
  category: "click",
  blurb: "Click fractures the field: branching fault lines tear the stripes apart, then the seams knit shut.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260722);
    const events: RiftEvent[] = [];
    const packed = {
      count: 0,
      bounds: new Float32Array(MAX_EVENTS * 4),
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
        for (let j = 0; j < SEGS_PER_EVENT; j++) {
          const base = (count * SEGS_PER_EVENT + j) * 4;
          const seg = event.segments[j];
          if (!seg) {
            packed.params[base] = EVENT_MS;
            packed.params[base + 1] = EVENT_MS;
            continue;
          }
          packed.segs[base] = seg.x0;
          packed.segs[base + 1] = seg.y0;
          packed.segs[base + 2] = seg.x1;
          packed.segs[base + 3] = seg.y1;
          packed.params[base] = seg.t0;
          packed.params[base + 1] = seg.t1;
          packed.params[base + 2] = seg.width;
          packed.params[base + 3] = seg.phase;
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

    const bindArrays = (gl: WebGL2RenderingContext, program: WebGLProgram): RiftUniforms => ({
      count: gl.getUniformLocation(program, "uEventCount"),
      bounds: gl.getUniformLocation(program, "uEventBounds"),
      segs: gl.getUniformLocation(program, "uSeg"),
      params: gl.getUniformLocation(program, "uSegT"),
    });

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, RIFT_FIELD_FRAG);
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
          gl.uniform1i(arrays.count, packed.count);
          gl.uniform4fv(arrays.bounds, packed.bounds);
          gl.uniform4fv(arrays.segs, packed.segs);
          gl.uniform4fv(arrays.params, packed.params);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, RIFT_POST_FRAG);
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
          gl.uniform1i(arrays.count, packed.count);
          gl.uniform4fv(arrays.bounds, packed.bounds);
          gl.uniform4fv(arrays.segs, packed.segs);
          gl.uniform4fv(arrays.params, packed.params);
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
    });

    const replay = () => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      spawn(w * (0.26 + 0.48 * rng()), h * (0.3 + 0.4 * rng()));
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
