import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { METEOR_DEPTH_FRAG, METEOR_DEPTH_MAX_METEORS } from "./meteor-depth.shaders";

const FIELD_SCALE = 0.75;
const RADIANT_ANGLE_RADIANS = (-35 * Math.PI) / 180;
const RADIANT_X = Math.cos(RADIANT_ANGLE_RADIANS);
const RADIANT_Y = Math.sin(RADIANT_ANGLE_RADIANS);
const RESYNC_LAG_SECONDS = 1.5;
const MAX_SPAWNS_PER_LAYER_PER_FRAME = 3;
const DEGREES = Math.PI / 180;

interface MeteorLayer {
  meanIntervalSeconds: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  lifetimeMin: number;
  lifetimeMax: number;
  speedMin: number;
  speedMax: number;
  lengthMin: number;
  lengthMax: number;
  bulkMin: number;
  bulkMax: number;
  angleSpread: number;
  pushScale: number;
  lightScale: number;
  carveScale: number;
  headScale: number;
}

const LAYERS: MeteorLayer[] = [
  {
    meanIntervalSeconds: 0.42,
    minIntervalSeconds: 0.08,
    maxIntervalSeconds: 1.8,
    lifetimeMin: 2.3,
    lifetimeMax: 3.4,
    speedMin: 0.34,
    speedMax: 0.48,
    lengthMin: 0.4,
    lengthMax: 0.62,
    bulkMin: 0.42,
    bulkMax: 0.62,
    angleSpread: 8 * DEGREES,
    pushScale: 0.18,
    lightScale: 0.42,
    carveScale: 0.3,
    headScale: 0.78,
  },
  {
    meanIntervalSeconds: 0.95,
    minIntervalSeconds: 0.22,
    maxIntervalSeconds: 3.2,
    lifetimeMin: 1.6,
    lifetimeMax: 2.4,
    speedMin: 0.62,
    speedMax: 0.86,
    lengthMin: 0.7,
    lengthMax: 0.98,
    bulkMin: 0.8,
    bulkMax: 1.05,
    angleSpread: 11 * DEGREES,
    pushScale: 0.44,
    lightScale: 0.7,
    carveScale: 0.62,
    headScale: 0.92,
  },
  {
    meanIntervalSeconds: 2.1,
    minIntervalSeconds: 0.7,
    maxIntervalSeconds: 5.5,
    lifetimeMin: 1.0,
    lifetimeMax: 1.5,
    speedMin: 1.14,
    speedMax: 1.5,
    lengthMin: 1.1,
    lengthMax: 1.45,
    bulkMin: 1.28,
    bulkMax: 1.68,
    angleSpread: 14 * DEGREES,
    pushScale: 0.72,
    lightScale: 1.0,
    carveScale: 1.0,
    headScale: 1.0,
  },
];

const REPLAY_SEQUENCE: { layer: number; delaySeconds: number; spawnX: number; spawnY: number }[] = [
  { layer: 0, delaySeconds: 0.0, spawnX: 0.12, spawnY: 1.06 },
  { layer: 1, delaySeconds: 0.85, spawnX: 0.42, spawnY: 1.08 },
  { layer: 2, delaySeconds: 1.75, spawnX: 0.72, spawnY: 1.1 },
];

interface MeteorState {
  spawnX: number;
  spawnY: number;
  bornAtSeconds: number;
  lifetimeSeconds: number;
  angleOffset: number;
  speedScale: number;
  lengthScale: number;
  bulkScale: number;
  layer: number;
}

interface PendingInjection {
  layer: number;
  atSeconds: number;
  spawnX: number;
  spawnY: number;
}

function randomBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

const definition: ExperimentDefinition = {
  id: "meteor-depth",
  title: "Meteor Depth",
  category: "stars",
  blurb:
    "Three depth layers of meteors drift through the starfield — distant ones faint and slow, near ones fast and carving.",
  pointer: "custom",
  create: (ctx) => {
    let requestDemo: (() => void) | null = null;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, METEOR_DEPTH_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCanvasSize = gl.getUniformLocation(program, "uCanvasSize");
      const uRadiantDirection = gl.getUniformLocation(program, "uRadiantDirection");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uMeteorCount = gl.getUniformLocation(program, "uMeteorCount");
      const uMeteorOrigin = gl.getUniformLocation(program, "uMeteorOrigin[0]");
      const uMeteorShape = gl.getUniformLocation(program, "uMeteorShape[0]");
      const uMeteorDepth = gl.getUniformLocation(program, "uMeteorDepth[0]");
      const originUniforms = new Float32Array(METEOR_DEPTH_MAX_METEORS * 4);
      const shapeUniforms = new Float32Array(METEOR_DEPTH_MAX_METEORS * 4);
      const depthUniforms = new Float32Array(METEOR_DEPTH_MAX_METEORS * 4);
      const random = createSeededRng(0x64657074);
      const meteors: MeteorState[] = [];
      const nextArrivalSeconds: (number | null)[] = LAYERS.map(() => null);
      const pending: PendingInjection[] = [];

      const sampleInterval = (layer: MeteorLayer) => {
        const uniform = Math.min(0.999999, Math.max(1e-6, random()));
        const exponential = -Math.log(1 - uniform) * layer.meanIntervalSeconds;
        return Math.min(layer.maxIntervalSeconds, Math.max(layer.minIntervalSeconds, exponential));
      };

      const spawnMeteor = (layerIndex: number, bornAtSeconds: number, origin?: { spawnX: number; spawnY: number }) => {
        const layer = LAYERS[layerIndex];
        if (meteors.length >= METEOR_DEPTH_MAX_METEORS) {
          let oldestIndex = 0;
          for (let index = 1; index < meteors.length; index++) {
            if (meteors[index].bornAtSeconds < meteors[oldestIndex].bornAtSeconds) oldestIndex = index;
          }
          meteors.splice(oldestIndex, 1);
        }
        const fromBottomEdge = random() < 0.62;
        meteors.push({
          spawnX:
            origin?.spawnX ??
            (fromBottomEdge ? randomBetween(random, -0.45, 1.05) : randomBetween(random, -0.42, -0.08)),
          spawnY:
            origin?.spawnY ?? (fromBottomEdge ? randomBetween(random, 1.02, 1.34) : randomBetween(random, 0.3, 1.05)),
          bornAtSeconds,
          lifetimeSeconds: randomBetween(random, layer.lifetimeMin, layer.lifetimeMax),
          angleOffset: randomBetween(random, -layer.angleSpread, layer.angleSpread),
          speedScale: randomBetween(random, layer.speedMin, layer.speedMax),
          lengthScale: randomBetween(random, layer.lengthMin, layer.lengthMax),
          bulkScale: randomBetween(random, layer.bulkMin, layer.bulkMax),
          layer: layerIndex,
        });
      };

      const pruneMeteors = (elapsedSeconds: number) => {
        for (let index = meteors.length - 1; index >= 0; index--) {
          const meteor = meteors[index];
          if (elapsedSeconds - meteor.bornAtSeconds > meteor.lifetimeSeconds) meteors.splice(index, 1);
        }
      };

      const triggerDemo = () => {
        pending.length = 0;
        for (const step of REPLAY_SEQUENCE) {
          pending.push({
            layer: step.layer,
            atSeconds: step.delaySeconds,
            spawnX: step.spawnX,
            spawnY: step.spawnY,
          });
        }
      };
      requestDemo = triggerDemo;

      let demoBaseSeconds: number | null = null;

      return {
        render(frame) {
          const elapsedSeconds = frame.elapsed / 1000;
          pruneMeteors(elapsedSeconds);

          if (pending.length > 0) {
            if (demoBaseSeconds === null) demoBaseSeconds = elapsedSeconds;
            for (let index = pending.length - 1; index >= 0; index--) {
              const injection = pending[index];
              if (elapsedSeconds >= demoBaseSeconds + injection.atSeconds) {
                spawnMeteor(injection.layer, elapsedSeconds, {
                  spawnX: injection.spawnX,
                  spawnY: injection.spawnY,
                });
                pending.splice(index, 1);
              }
            }
            if (pending.length === 0) demoBaseSeconds = null;
          }

          for (let layerIndex = 0; layerIndex < LAYERS.length; layerIndex++) {
            const layer = LAYERS[layerIndex];
            let nextArrival = nextArrivalSeconds[layerIndex];
            if (nextArrival === null) nextArrival = elapsedSeconds + sampleInterval(layer) * 0.4;
            if (elapsedSeconds - nextArrival > RESYNC_LAG_SECONDS) nextArrival = elapsedSeconds;
            let spawned = 0;
            while (elapsedSeconds >= nextArrival && spawned < MAX_SPAWNS_PER_LAYER_PER_FRAME) {
              spawnMeteor(layerIndex, nextArrival);
              nextArrival += sampleInterval(layer);
              spawned++;
            }
            nextArrivalSeconds[layerIndex] = nextArrival;
          }

          originUniforms.fill(0);
          shapeUniforms.fill(0);
          depthUniforms.fill(0);
          for (let index = 0; index < meteors.length; index++) {
            const meteor = meteors[index];
            const layer = LAYERS[meteor.layer];
            const offset = index * 4;
            originUniforms[offset] = meteor.spawnX;
            originUniforms[offset + 1] = meteor.spawnY;
            originUniforms[offset + 2] = elapsedSeconds - meteor.bornAtSeconds;
            originUniforms[offset + 3] = meteor.lifetimeSeconds;
            shapeUniforms[offset] = meteor.angleOffset;
            shapeUniforms[offset + 1] = meteor.speedScale;
            shapeUniforms[offset + 2] = meteor.lengthScale;
            shapeUniforms[offset + 3] = meteor.bulkScale;
            depthUniforms[offset] = layer.pushScale;
            depthUniforms[offset + 1] = layer.lightScale;
            depthUniforms[offset + 2] = layer.carveScale;
            depthUniforms[offset + 3] = layer.headScale;
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCanvasSize, Math.max(1, frame.cssW), Math.max(1, frame.cssH));
          gl.uniform2f(uRadiantDirection, RADIANT_X, RADIANT_Y);
          gl.uniform1f(uTime, elapsedSeconds);
          gl.uniform1i(uMeteorCount, meteors.length);
          gl.uniform4fv(uMeteorOrigin, originUniforms);
          gl.uniform4fv(uMeteorShape, shapeUniforms);
          gl.uniform4fv(uMeteorDepth, depthUniforms);
          quad.draw();
        },
        dispose() {
          if (requestDemo === triggerDemo) requestDemo = null;
          pending.length = 0;
          meteors.length = 0;
          gl.deleteProgram(program);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { fieldScale: FIELD_SCALE, hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      background: {
        ...EXPERIMENT_BASE_CONFIG.background,
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
      replay: () => requestDemo?.(),
      destroy: () => {
        disposed = true;
        image.onload = null;
        engine.dispose();
        requestDemo = null;
      },
    };
  },
};

export default definition;
