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
import { CHAIN_FIELD_FRAG, CHAIN_MAX_DETONATIONS, CHAIN_MAX_FUSES, CHAIN_POST_FRAG } from "./chain-detonation.shaders";

const MAX_CHAINS = 2;
const EVENT_MS = 3400;
const FLASH_MS = 80;
const SHOCK_MS = 600;
const INTRO_DELAY_MS = 700;

interface Link {
  x: number;
  y: number;
  seed: number;
  scale: number;
  duration: number;
  fireAtMs: number;
  armAtMs: number;
  fired: boolean;
}

interface Chain {
  baseMs: number | null;
  endsAtMs: number;
  links: Link[];
}

interface Detonation {
  x: number;
  y: number;
  seed: number;
  scale: number;
  duration: number;
  startMs: number;
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

const durationFor = (scale: number): number => 0.72 + 0.28 * scale;

function arrivalMs(distance: number, scaleUnits: number, duration: number): number {
  const reach = 168 * scaleUnits;
  const ts = Math.min(1, Math.pow(Math.max(distance, 0) / Math.max(reach, 1e-3), 1 / 0.42));
  return ts * SHOCK_MS * duration;
}

const definition: ExperimentDefinition = {
  id: "chain-detonation",
  title: "Chain Detonation",
  category: "click",
  blurb: "One click detonates, and its shock front sets off a stagger of smaller secondary blasts — a chain reaction.",
  pointer: "custom",
  create: (ctx) => {
    const rng = createSeededRng(20260722);
    const chains: Chain[] = [];
    const dets: Detonation[] = [];

    const packed = {
      count: 0,
      centers: new Float32Array(CHAIN_MAX_DETONATIONS * 2),
      ages: new Float32Array(CHAIN_MAX_DETONATIONS),
      seeds: new Float32Array(CHAIN_MAX_DETONATIONS),
      flashes: new Float32Array(CHAIN_MAX_DETONATIONS),
      scales: new Float32Array(CHAIN_MAX_DETONATIONS),
      fuseCount: 0,
      fuseCenters: new Float32Array(CHAIN_MAX_FUSES * 2),
      fuseHeats: new Float32Array(CHAIN_MAX_FUSES),
      fuseScales: new Float32Array(CHAIN_MAX_FUSES),
    };

    const buildChain = (x: number, y: number) => {
      const w = Math.max(1, ctx.canvas.clientWidth);
      const h = Math.max(1, ctx.canvas.clientHeight);
      const minDim = Math.min(w, h);
      const scaleUnits = Math.min(2.5, Math.max(0.5, minDim / 300));
      const padX = w * 0.09;
      const padY = h * 0.11;

      const links: Link[] = [];
      const primary: Link = {
        x: Math.min(w - padX, Math.max(padX, x)),
        y: Math.min(h - padY, Math.max(padY, y)),
        seed: 1 + rng() * 96,
        scale: 1,
        duration: durationFor(1),
        fireAtMs: 0,
        armAtMs: 0,
        fired: false,
      };
      links.push(primary);

      const secondaries = 2 + (rng() < 0.55 ? 1 : 0);
      let angle = rng() * Math.PI * 2;
      let parent = primary;
      for (let k = 0; k < secondaries; k++) {
        const scale = Math.min(0.65, Math.max(0.45, 0.63 - 0.06 * k + (rng() - 0.5) * 0.12));
        const distance = minDim * (0.15 + 0.15 * rng());
        let nx = parent.x;
        let ny = parent.y;
        let found = false;
        for (let attempt = 0; attempt < 7; attempt++) {
          const turn = (0.7 + rng() * 0.9) * (rng() < 0.5 ? -1 : 1);
          const candidate = k === 0 ? angle + (rng() - 0.5) * 1.4 : angle + turn;
          const cx = parent.x + Math.cos(candidate) * distance;
          const cy = parent.y + Math.sin(candidate) * distance;
          if (cx >= padX && cx <= w - padX && cy >= padY && cy <= h - padY) {
            angle = candidate;
            nx = cx;
            ny = cy;
            found = true;
            break;
          }
        }
        if (!found) {
          const toCenter = Math.atan2(h * 0.5 - parent.y, w * 0.5 - parent.x) + (rng() - 0.5) * 0.8;
          angle = toCenter;
          nx = Math.min(w - padX, Math.max(padX, parent.x + Math.cos(toCenter) * distance));
          ny = Math.min(h - padY, Math.max(padY, parent.y + Math.sin(toCenter) * distance));
        }

        const reachMs = arrivalMs(Math.hypot(nx - parent.x, ny - parent.y), scaleUnits * parent.scale, parent.duration);
        const fuseMs = 74 + rng() * 72;
        const gap = Math.min(280, Math.max(112, reachMs + fuseMs));
        const link: Link = {
          x: nx,
          y: ny,
          seed: 1 + rng() * 96,
          scale,
          duration: durationFor(scale),
          fireAtMs: parent.fireAtMs + gap,
          armAtMs: parent.fireAtMs + Math.min(gap - 26, reachMs),
          fired: false,
        };
        links.push(link);
        parent = link;
      }

      const last = links[links.length - 1];
      if (chains.length >= MAX_CHAINS) chains.shift();
      chains.push({ baseMs: null, endsAtMs: last.fireAtMs + EVENT_MS * last.duration, links });
    };

    const step = (now: number) => {
      let keep = 0;
      for (const chain of chains) {
        const base = chain.baseMs ?? now;
        chain.baseMs = base;
        const local = now - base;
        for (const link of chain.links) {
          if (link.fired || local < link.fireAtMs) continue;
          link.fired = true;
          if (dets.length >= CHAIN_MAX_DETONATIONS) dets.shift();
          dets.push({
            x: link.x,
            y: link.y,
            seed: link.seed,
            scale: link.scale,
            duration: link.duration,
            startMs: base + link.fireAtMs,
          });
        }
        if (local <= chain.endsAtMs) chains[keep++] = chain;
      }
      chains.length = keep;

      let write = 0;
      for (const det of dets) {
        if (now - det.startMs <= EVENT_MS * det.duration) dets[write++] = det;
      }
      dets.length = write;

      let count = 0;
      for (const det of dets) {
        if (count >= CHAIN_MAX_DETONATIONS) break;
        const age = now - det.startMs;
        packed.centers[count * 2] = det.x;
        packed.centers[count * 2 + 1] = det.y;
        packed.ages[count] = age / 1000 / det.duration;
        packed.seeds[count] = det.seed;
        packed.scales[count] = det.scale;
        packed.flashes[count] = standardEase(Math.min(1, age / (FLASH_MS * det.duration)));
        count++;
      }
      packed.count = count;

      let fuses = 0;
      for (const chain of chains) {
        const base = chain.baseMs;
        if (base === null) continue;
        const local = now - base;
        for (const link of chain.links) {
          if (fuses >= CHAIN_MAX_FUSES) break;
          if (link.fired || local < link.armAtMs) continue;
          const span = Math.max(1, link.fireAtMs - link.armAtMs);
          packed.fuseCenters[fuses * 2] = link.x;
          packed.fuseCenters[fuses * 2 + 1] = link.y;
          packed.fuseHeats[fuses] = standardEase(Math.min(1, (local - link.armAtMs) / span));
          packed.fuseScales[fuses] = link.scale;
          fuses++;
        }
      }
      packed.fuseCount = fuses;
    };

    const onDown = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      const sx = ctx.canvas.clientWidth / Math.max(1, rect.width);
      const sy = ctx.canvas.clientHeight / Math.max(1, rect.height);
      buildChain((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    };
    ctx.canvas.addEventListener("pointerdown", onDown);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, CHAIN_FIELD_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uDetCount = gl.getUniformLocation(program, "uDetCount");
      const uDetCenter = gl.getUniformLocation(program, "uDetCenter");
      const uDetAge = gl.getUniformLocation(program, "uDetAge");
      const uDetSeed = gl.getUniformLocation(program, "uDetSeed");
      const uDetFlash = gl.getUniformLocation(program, "uDetFlash");
      const uDetScale = gl.getUniformLocation(program, "uDetScale");
      const uFuseCount = gl.getUniformLocation(program, "uFuseCount");
      const uFuseCenter = gl.getUniformLocation(program, "uFuseCenter");
      const uFuseHeat = gl.getUniformLocation(program, "uFuseHeat");
      const uFuseScale = gl.getUniformLocation(program, "uFuseScale");
      return {
        render(frame) {
          step(frame.now);
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
          gl.uniform1fv(uDetScale, packed.scales);
          gl.uniform1i(uFuseCount, packed.fuseCount);
          gl.uniform2fv(uFuseCenter, packed.fuseCenters);
          gl.uniform1fv(uFuseHeat, packed.fuseHeats);
          gl.uniform1fv(uFuseScale, packed.fuseScales);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const postPass = ({ gl, quad }: EngineHookContext): PostHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, CHAIN_POST_FRAG);
      const uSrc = gl.getUniformLocation(program, "uSrc");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uDetCount = gl.getUniformLocation(program, "uDetCount");
      const uDetCenter = gl.getUniformLocation(program, "uDetCenter");
      const uDetAge = gl.getUniformLocation(program, "uDetAge");
      const uDetSeed = gl.getUniformLocation(program, "uDetSeed");
      const uDetScale = gl.getUniformLocation(program, "uDetScale");
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
          gl.uniform1fv(uDetScale, packed.scales);
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
      buildChain(w * (0.26 + 0.48 * rng()), h * (0.3 + 0.4 * rng()));
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
