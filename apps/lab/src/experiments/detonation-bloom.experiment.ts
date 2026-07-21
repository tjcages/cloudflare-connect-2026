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
import { DETONATION_FIELD_FRAG, DETONATION_POST_FRAG } from "./detonation-bloom.shaders";

const MAX_DETONATIONS = 4;
const EVENT_MS = 3400;
const FLASH_MS = 80;
const INTRO_DELAY_MS = 650;

interface Detonation {
  x: number;
  y: number;
  seed: number;
  startMs: number | null;
}

const bezierX = (u: number): number => 3 * u * (1 - u) * (1 - u) * 0.6 + u * u * u;
const bezierY = (u: number): number => 3 * u * (1 - u) * (1 - u) * 0.6 + 3 * u * u * (1 - u) + u * u * u;

function standardEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let mid = t;
  for (let i = 0; i < 22; i++) {
    mid = (lo + hi) * 0.5;
    if (bezierX(mid) < t) lo = mid;
    else hi = mid;
  }
  return bezierY(mid);
}

const definition: ExperimentDefinition = {
  id: "detonation-bloom",
  title: "Detonation Bloom",
  category: "click",
  blurb:
    "Click detonates: flash core, refracting shock ring, ballistic ember debris, and a crater dent that slowly relaxes.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260721);
    const dets: Detonation[] = [];
    const packed = {
      count: 0,
      centers: new Float32Array(MAX_DETONATIONS * 2),
      ages: new Float32Array(MAX_DETONATIONS),
      seeds: new Float32Array(MAX_DETONATIONS),
      flashes: new Float32Array(MAX_DETONATIONS),
    };

    const packDetonations = (now: number) => {
      let write = 0;
      for (const det of dets) {
        if (det.startMs === null) det.startMs = now;
        if (now - det.startMs <= EVENT_MS) dets[write++] = det;
      }
      dets.length = write;
      let count = 0;
      for (const det of dets) {
        if (count >= MAX_DETONATIONS) break;
        const age = now - (det.startMs ?? now);
        packed.centers[count * 2] = det.x;
        packed.centers[count * 2 + 1] = det.y;
        packed.ages[count] = age / 1000;
        packed.seeds[count] = det.seed;
        packed.flashes[count] = standardEase(Math.min(1, age / FLASH_MS));
        count++;
      }
      packed.count = count;
    };

    const spawn = (x: number, y: number) => {
      if (dets.length >= MAX_DETONATIONS) dets.shift();
      dets.push({ x, y, seed: 1 + rng() * 96, startMs: null });
    };

    const onDown = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      spawn((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    };
    ctx.canvas.addEventListener("pointerdown", onDown);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, DETONATION_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uDetCount = gl.getUniformLocation(program, "uDetCount");
      const uDetCenter = gl.getUniformLocation(program, "uDetCenter");
      const uDetAge = gl.getUniformLocation(program, "uDetAge");
      const uDetSeed = gl.getUniformLocation(program, "uDetSeed");
      const uDetFlash = gl.getUniformLocation(program, "uDetFlash");
      return {
        render(frame) {
          packDetonations(frame.now);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uDetCount, packed.count);
          gl.uniform2fv(uDetCenter, packed.centers);
          gl.uniform1fv(uDetAge, packed.ages);
          gl.uniform1fv(uDetSeed, packed.seeds);
          gl.uniform1fv(uDetFlash, packed.flashes);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, DETONATION_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uDetCount = gl.getUniformLocation(program, "uDetCount");
      const uDetCenter = gl.getUniformLocation(program, "uDetCenter");
      const uDetAge = gl.getUniformLocation(program, "uDetAge");
      const uDetSeed = gl.getUniformLocation(program, "uDetSeed");
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uDetCount, packed.count);
          gl.uniform2fv(uDetCenter, packed.centers);
          gl.uniform1fv(uDetAge, packed.ages);
          gl.uniform1fv(uDetSeed, packed.seeds);
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
      spawn(w * (0.22 + 0.56 * rng()), h * (0.28 + 0.44 * rng()));
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
