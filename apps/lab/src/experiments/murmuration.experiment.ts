import {
  compileProgram,
  createPingPong,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
  type PingPong,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import {
  MURMURATION_COMPOSITE_FRAG,
  MURMURATION_DECAY_FRAG,
  MURMURATION_STREAK_FRAG,
  MURMURATION_STREAK_VERT,
} from "./murmuration.shaders";
import {
  createMurmurationSim,
  createPredatorDart,
  flockCentroid,
  murmurationScale,
  predatorPoint,
  seedMurmuration,
  stepMurmuration,
  type PredatorDart,
} from "./murmuration.sim";

const AGENT_COUNT = 170;
const FLOATS_PER_INSTANCE = 6;
const INSTANCE_STRIDE_BYTES = FLOATS_PER_INSTANCE * 4;
const TRAIL_TAU_SEC = 0.24;
const GHOST_WEIGHT = 0.15;
const STREAK_ALPHA = 0.9;
const STREAK_WIDTH = 5;

const definition: ExperimentDefinition = {
  id: "murmuration",
  title: "Murmuration",
  category: "ambience",
  blurb: "A flock of micro-agents flows, splits, and merges across the field, gently parting around the cursor.",
  create: (ctx) => {
    const random = createSeededRng(0x5eed);
    const sim = createMurmurationSim(AGENT_COUNT, random);
    let dart: PredatorDart | null = null;
    let dartRequested = false;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const decayProgram = compileProgram(gl, FULLSCREEN_VERT, MURMURATION_DECAY_FRAG);
      const streakProgram = compileProgram(gl, MURMURATION_STREAK_VERT, MURMURATION_STREAK_FRAG);
      const compositeProgram = compileProgram(gl, FULLSCREEN_VERT, MURMURATION_COMPOSITE_FRAG);
      const uDecayTrail = gl.getUniformLocation(decayProgram, "uTrail");
      const uDecay = gl.getUniformLocation(decayProgram, "uDecay");
      const uFloor = gl.getUniformLocation(decayProgram, "uFloor");
      const uCanvas = gl.getUniformLocation(streakProgram, "uCanvas");
      const uField = gl.getUniformLocation(compositeProgram, "uField");
      const uTrail = gl.getUniformLocation(compositeProgram, "uTrail");
      const uGhost = gl.getUniformLocation(compositeProgram, "uGhost");

      const vao = gl.createVertexArray();
      const instanceBuf = gl.createBuffer();
      if (!vao || !instanceBuf) throw new Error("Failed to create murmuration GL objects");
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
      const aPose = gl.getAttribLocation(streakProgram, "aPose");
      const aSize = gl.getAttribLocation(streakProgram, "aSize");
      gl.enableVertexAttribArray(aPose);
      gl.vertexAttribPointer(aPose, 4, gl.FLOAT, false, INSTANCE_STRIDE_BYTES, 0);
      gl.vertexAttribDivisor(aPose, 1);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 2, gl.FLOAT, false, INSTANCE_STRIDE_BYTES, 16);
      gl.vertexAttribDivisor(aSize, 1);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      const instanceData = new Float32Array((AGENT_COUNT + 1) * FLOATS_PER_INSTANCE);
      let trail: PingPong | null = null;
      let trailW = 0;
      let trailH = 0;

      const ensureTrail = (w: number, h: number): PingPong => {
        if (trail && trailW === w && trailH === h) return trail;
        if (!trail) trail = createPingPong(gl, w, h, { linear: true });
        else trail.resize(w, h);
        trailW = w;
        trailH = h;
        for (const rt of [trail.read(), trail.write()]) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
          gl.viewport(0, 0, w, h);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        return trail;
      };

      return {
        render(frame) {
          if (!sim.initialized) seedMurmuration(sim, frame.cssW, frame.cssH);
          const dtMs = sim.lastNowMs < 0 ? 16.7 : frame.now - sim.lastNowMs;
          sim.lastNowMs = frame.now;
          const dt = Math.min(Math.max(dtMs, 0), 50) / 1000;

          if (dartRequested) {
            dartRequested = false;
            const centroid = flockCentroid(sim);
            dart = createPredatorDart(frame.cssW, frame.cssH, centroid.x, centroid.y, frame.now, random);
          }
          let predX = 0;
          let predY = 0;
          let predAngle = 0;
          let predActive = false;
          if (dart) {
            const p = predatorPoint(dart, frame.now);
            if (p.done) {
              dart = null;
            } else {
              predX = p.x;
              predY = p.y;
              predAngle = p.angle;
              predActive = true;
            }
          }

          const cursor = frame.cursor();
          stepMurmuration(sim, {
            width: frame.cssW,
            height: frame.cssH,
            timeSec: frame.elapsed / 1000,
            dtSec: dt,
            cursorX: cursor ? cursor.x : 0,
            cursorY: cursor ? cursor.y : 0,
            cursorActive: cursor !== null,
            predatorX: predX,
            predatorY: predY,
            predatorActive: predActive,
          });

          const scale = murmurationScale(frame.cssW, frame.cssH);
          let instances = 0;
          for (let i = 0; i < sim.count; i++) {
            const speed = Math.hypot(sim.vx[i], sim.vy[i]);
            const base = instances * FLOATS_PER_INSTANCE;
            instanceData[base] = sim.x[i];
            instanceData[base + 1] = sim.y[i];
            instanceData[base + 2] = Math.atan2(sim.vy[i], sim.vx[i]);
            instanceData[base + 3] = STREAK_ALPHA;
            instanceData[base + 4] = 6 * scale + speed * 0.09;
            instanceData[base + 5] = STREAK_WIDTH * scale;
            instances++;
          }
          if (predActive) {
            const base = instances * FLOATS_PER_INSTANCE;
            instanceData[base] = predX;
            instanceData[base + 1] = predY;
            instanceData[base + 2] = predAngle;
            instanceData[base + 3] = 1;
            instanceData[base + 4] = 30 * scale;
            instanceData[base + 5] = 9 * scale;
            instances++;
          }

          const trailPP = ensureTrail(frame.output.width, frame.output.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, trailPP.write().fbo);
          gl.viewport(0, 0, trailW, trailH);
          gl.useProgram(decayProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, trailPP.read().texture);
          gl.uniform1i(uDecayTrail, 0);
          gl.uniform1f(uDecay, Math.exp(-dt / TRAIL_TAU_SEC));
          gl.uniform1f(uFloor, Math.min(0.02, dt * 0.24));
          quad.draw();

          gl.useProgram(streakProgram);
          gl.uniform2f(uCanvas, frame.cssW, frame.cssH);
          gl.bindVertexArray(vao);
          gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuf);
          gl.bufferData(gl.ARRAY_BUFFER, instanceData.subarray(0, instances * FLOATS_PER_INSTANCE), gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances);
          gl.disable(gl.BLEND);
          gl.bindVertexArray(null);
          trailPP.swap();

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(compositeProgram);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, trailPP.read().texture);
          gl.uniform1i(uTrail, 1);
          gl.uniform1f(uGhost, GHOST_WEIGHT);
          quad.draw();
        },
        dispose() {
          if (trail) trail.dispose();
          trail = null;
          gl.deleteProgram(decayProgram);
          gl.deleteProgram(streakProgram);
          gl.deleteProgram(compositeProgram);
          gl.deleteVertexArray(vao);
          gl.deleteBuffer(instanceBuf);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      background: {
        ...DEFAULT_ENGINE_CONFIG.background,
        stars: { ...DEFAULT_ENGINE_CONFIG.background.stars, enabled: false },
      },
    });

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => {
        dartRequested = true;
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
