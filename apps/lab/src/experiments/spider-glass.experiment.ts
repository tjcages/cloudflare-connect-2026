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
import { GLASS_FIELD_FRAG, GLASS_POST_FRAG } from "./spider-glass.shaders";

const MAX_EVENTS = 3;
const SEGS_PER_EVENT = 24;
const RADIAL_SPAN_MS = 300;
const EVENT_MS = 5000;
const INTRO_DELAY_MS = 700;
const IDLE_TIME = 1000;
const TAU = Math.PI * 2;

interface GlassSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  t1: number;
  width: number;
  phase: number;
}

interface GlassEvent {
  cx: number;
  cy: number;
  radius: number;
  inner: number;
  seed: number;
  cell: number;
  segments: GlassSegment[];
  startMs: number | null;
}

interface RingVertex {
  x: number;
  y: number;
  arrival: number;
}

interface GlassUniforms {
  count: WebGLUniformLocation | null;
  bounds: WebGLUniformLocation | null;
  shape: WebGLUniformLocation | null;
}

function buildEvent(x: number, y: number, sc: number, rng: () => number): GlassEvent {
  const radialCount = 6 + Math.floor(rng() * 3);
  const ringCount = Math.max(2, Math.floor(SEGS_PER_EVENT / radialCount) - 1);
  const inner = (32 + 11 * rng()) * sc;
  const ringStep = ringCount > 2 ? 0.95 : 1.28;

  const angles: number[] = [];
  const baseAngle = rng() * TAU;
  for (let i = 0; i < radialCount; i++) {
    angles.push(baseAngle + (i / radialCount) * TAU + (rng() - 0.5) * (TAU / radialCount) * 0.5);
  }

  const ringRadii: number[] = [];
  for (let k = 0; k < ringCount; k++) {
    ringRadii.push(inner * (1.42 + k * ringStep + 0.3 * rng()));
  }
  const outerRing = ringRadii[ringRadii.length - 1] ?? inner * 2;

  const lengths: number[] = [];
  let maxLen = 0;
  for (let i = 0; i < radialCount; i++) {
    const len = outerRing * (1.14 + 0.34 * rng());
    lengths.push(len);
    maxLen = Math.max(maxLen, len);
  }

  const speed = maxLen / (RADIAL_SPAN_MS / 1000);
  const ringSpeed = speed * 0.5;
  const segments: GlassSegment[] = [];

  for (let i = 0; i < radialCount; i++) {
    const angle = angles[i] ?? 0;
    const len = lengths[i] ?? maxLen;
    segments.push({
      x0: x,
      y0: y,
      x1: x + Math.cos(angle) * len,
      y1: y + Math.sin(angle) * len,
      t0: 0,
      t1: len / speed,
      width: 0.94 + 0.14 * rng(),
      phase: rng(),
    });
  }

  const vertexAt = (i: number, k: number): RingVertex => {
    const angle = (angles[i] ?? 0) + (rng() - 0.5) * 0.09;
    const radius = (ringRadii[k] ?? inner) * (0.93 + 0.14 * rng());
    return {
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
      arrival: radius / speed,
    };
  };

  for (let k = 0; k < ringCount; k++) {
    const verts: RingVertex[] = [];
    for (let i = 0; i < radialCount; i++) verts.push(vertexAt(i, k));
    for (let i = 0; i < radialCount; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % radialCount];
      if (!a || !b) continue;
      const chord = Math.hypot(b.x - a.x, b.y - a.y);
      const t0 = Math.max(a.arrival, b.arrival) + 0.05 + 0.07 * rng();
      segments.push({
        x0: a.x,
        y0: a.y,
        x1: b.x,
        y1: b.y,
        t0,
        t1: t0 + chord / ringSpeed,
        width: -(0.6 - 0.12 * k + 0.08 * rng()),
        phase: rng(),
      });
    }
  }

  return {
    cx: x,
    cy: y,
    radius: maxLen + 70 * sc,
    inner,
    seed: rng(),
    cell: (8.5 + 2.5 * rng()) * sc,
    segments,
    startMs: null,
  };
}

const definition: ExperimentDefinition = {
  id: "spider-glass",
  title: "Spider Glass",
  category: "click",
  blurb: "Click shatters the field like impacted glass: radial and ring cracks web outward, then knit shut.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260731);
    const events: GlassEvent[] = [];
    const packed = {
      count: 0,
      bounds: new Float32Array(MAX_EVENTS * 4),
      shape: new Float32Array(MAX_EVENTS * 4),
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
        packed.shape[count * 4] = event.inner;
        packed.shape[count * 4 + 1] = event.seed;
        packed.shape[count * 4 + 2] = event.cell;
        packed.shape[count * 4 + 3] = 0;
        for (let j = 0; j < SEGS_PER_EVENT; j++) {
          const base = (count * SEGS_PER_EVENT + j) * 4;
          const seg = event.segments[j];
          if (!seg) {
            packed.params[base] = IDLE_TIME;
            packed.params[base + 1] = IDLE_TIME;
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

    const bindShared = (gl: WebGL2RenderingContext, program: WebGLProgram): GlassUniforms => ({
      count: gl.getUniformLocation(program, "uEventCount"),
      bounds: gl.getUniformLocation(program, "uEventBounds"),
      shape: gl.getUniformLocation(program, "uEventShape"),
    });

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, GLASS_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uSeg = gl.getUniformLocation(program, "uSeg");
      const uSegT = gl.getUniformLocation(program, "uSegT");
      const shared = bindShared(gl, program);
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
          gl.uniform1i(shared.count, packed.count);
          gl.uniform4fv(shared.bounds, packed.bounds);
          gl.uniform4fv(shared.shape, packed.shape);
          gl.uniform4fv(uSeg, packed.segs);
          gl.uniform4fv(uSegT, packed.params);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, GLASS_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const shared = bindShared(gl, program);
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(shared.count, packed.count);
          gl.uniform4fv(shared.bounds, packed.bounds);
          gl.uniform4fv(shared.shape, packed.shape);
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
