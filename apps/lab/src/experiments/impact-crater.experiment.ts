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
import { CRATER_FIELD_FRAG, CRATER_POST_FRAG } from "./impact-crater.shaders";

const MAX_CRATERS = 4;
const CRATER_LIFE_MS = 4600;
const INTRO_DELAY_MS = 700;

interface Crater {
  x: number;
  y: number;
  seed: number;
  power: number;
  startMs: number | null;
}

const definition: ExperimentDefinition = {
  id: "impact-crater",
  title: "Impact Crater",
  category: "click",
  blurb: "Click lands like mass: the stripes compress outward, pile into a rim, and the dent slowly relaxes.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260722);
    const craters: Crater[] = [];
    const packed = {
      count: 0,
      centers: new Float32Array(MAX_CRATERS * 2),
      ages: new Float32Array(MAX_CRATERS),
      seeds: new Float32Array(MAX_CRATERS),
      powers: new Float32Array(MAX_CRATERS),
    };

    const packCraters = (now: number) => {
      let write = 0;
      for (const crater of craters) {
        if (crater.startMs === null) crater.startMs = now;
        if (now - crater.startMs <= CRATER_LIFE_MS) craters[write++] = crater;
      }
      craters.length = write;
      let count = 0;
      for (const crater of craters) {
        if (count >= MAX_CRATERS) break;
        packed.centers[count * 2] = crater.x;
        packed.centers[count * 2 + 1] = crater.y;
        packed.ages[count] = (now - (crater.startMs ?? now)) / 1000;
        packed.seeds[count] = crater.seed;
        packed.powers[count] = crater.power;
        count++;
      }
      packed.count = count;
    };

    const spawn = (x: number, y: number) => {
      if (craters.length >= MAX_CRATERS) craters.shift();
      craters.push({ x, y, seed: 1 + rng() * 96, power: 0.86 + rng() * 0.3, startMs: null });
    };

    const onDown = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      spawn((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    };
    ctx.canvas.addEventListener("pointerdown", onDown);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, CRATER_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uCount = gl.getUniformLocation(program, "uCraterCount");
      const uCenter = gl.getUniformLocation(program, "uCraterCenter");
      const uAge = gl.getUniformLocation(program, "uCraterAge");
      const uSeed = gl.getUniformLocation(program, "uCraterSeed");
      const uPower = gl.getUniformLocation(program, "uCraterPower");
      return {
        render(frame) {
          packCraters(frame.now);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uCount, packed.count);
          gl.uniform2fv(uCenter, packed.centers);
          gl.uniform1fv(uAge, packed.ages);
          gl.uniform1fv(uSeed, packed.seeds);
          gl.uniform1fv(uPower, packed.powers);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, CRATER_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uCount = gl.getUniformLocation(program, "uCraterCount");
      const uCenter = gl.getUniformLocation(program, "uCraterCenter");
      const uAge = gl.getUniformLocation(program, "uCraterAge");
      const uSeed = gl.getUniformLocation(program, "uCraterSeed");
      const uPower = gl.getUniformLocation(program, "uCraterPower");
      return {
        render(src, dst, frame) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fbo : null);
          gl.viewport(0, 0, dst ? dst.width : frame.outputWidth, dst ? dst.height : frame.outputHeight);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, src);
          gl.uniform1i(uSrc, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1i(uCount, packed.count);
          gl.uniform2fv(uCenter, packed.centers);
          gl.uniform1fv(uAge, packed.ages);
          gl.uniform1fv(uSeed, packed.seeds);
          gl.uniform1fv(uPower, packed.powers);
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
