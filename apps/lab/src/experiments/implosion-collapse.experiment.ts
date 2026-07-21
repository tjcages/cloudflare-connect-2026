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
import { IMPLOSION_FIELD_FRAG, IMPLOSION_POST_FRAG } from "./implosion-collapse.shaders";

const MAX_EVENTS = 3;
const EVENT_MS = 1600;
const INTRO_DELAY_MS = 650;
const SPAWN_DEDUPE_MS = 90;

interface Implosion {
  x: number;
  y: number;
  seed: number;
  startMs: number | null;
}

const definition: ExperimentDefinition = {
  id: "implosion-collapse",
  title: "Implosion Collapse",
  category: "click",
  blurb:
    "Click pulls the field inward, compresses it into a tight knot, holds a beat, then lets go with one soft rebound puff.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260722);
    const events: Implosion[] = [];
    const packed = {
      count: 0,
      centers: new Float32Array(MAX_EVENTS * 2),
      ages: new Float32Array(MAX_EVENTS),
      seeds: new Float32Array(MAX_EVENTS),
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
        packed.centers[count * 2] = event.x;
        packed.centers[count * 2 + 1] = event.y;
        packed.ages[count] = (now - (event.startMs ?? now)) / 1000;
        packed.seeds[count] = event.seed;
        count++;
      }
      packed.count = count;
    };

    const spawn = (x: number, y: number) => {
      if (events.length >= MAX_EVENTS) events.shift();
      events.push({ x, y, seed: 1 + rng() * 96, startMs: null });
    };

    let lastSpawnMs = -Infinity;
    const onDown = (e: Event) => {
      const now = performance.now();
      if (now - lastSpawnMs < SPAWN_DEDUPE_MS) return;
      lastSpawnMs = now;
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = w / Math.max(1, rect.width);
      const sy = h / Math.max(1, rect.height);
      const point = e as MouseEvent;
      const px = (point.clientX - rect.left) * sx;
      const py = (point.clientY - rect.top) * sy;
      const usable = Number.isFinite(px) && Number.isFinite(py) && px > 0.5 && py > 0.5 && px < w && py < h;
      spawn(usable ? px : w * 0.5, usable ? py : h * 0.5);
    };
    const downEvents = ["pointerdown", "mousedown", "click"] as const;
    for (const name of downEvents) ctx.canvas.addEventListener(name, onDown);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, IMPLOSION_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uEventCount = gl.getUniformLocation(program, "uEventCount");
      const uEventCenter = gl.getUniformLocation(program, "uEventCenter");
      const uEventAge = gl.getUniformLocation(program, "uEventAge");
      const uEventSeed = gl.getUniformLocation(program, "uEventSeed");
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
          gl.uniform1i(uEventCount, packed.count);
          gl.uniform2fv(uEventCenter, packed.centers);
          gl.uniform1fv(uEventAge, packed.ages);
          gl.uniform1fv(uEventSeed, packed.seeds);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, IMPLOSION_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uEventCount = gl.getUniformLocation(program, "uEventCount");
      const uEventCenter = gl.getUniformLocation(program, "uEventCenter");
      const uEventAge = gl.getUniformLocation(program, "uEventAge");
      const uEventSeed = gl.getUniformLocation(program, "uEventSeed");
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uEventCount, packed.count);
          gl.uniform2fv(uEventCenter, packed.centers);
          gl.uniform1fv(uEventAge, packed.ages);
          gl.uniform1fv(uEventSeed, packed.seeds);
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
      spawn(w * (0.24 + 0.52 * rng()), h * (0.3 + 0.4 * rng()));
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
        for (const name of downEvents) ctx.canvas.removeEventListener(name, onDown);
        engine.dispose();
      },
    };
  },
};

export default definition;
