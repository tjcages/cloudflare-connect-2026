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
import { METEOR_SHOWER_FRAG, METEOR_SHOWER_MAX_METEORS } from "./meteor-shower.shaders";

const FIELD_SCALE = 0.75;
const RADIANT_ANGLE_RADIANS = (-35 * Math.PI) / 180;
const RADIANT_X = Math.cos(RADIANT_ANGLE_RADIANS);
const RADIANT_Y = Math.sin(RADIANT_ANGLE_RADIANS);
const MEAN_INTERVAL_SECONDS = 0.2;
const MIN_INTERVAL_SECONDS = 0.03;
const MAX_INTERVAL_SECONDS = 2.2;
const RESYNC_LAG_SECONDS = 1.5;
const MAX_SPAWNS_PER_FRAME = 10;

interface MeteorState {
  spawnX: number;
  spawnY: number;
  bornAtSeconds: number;
  lifetimeSeconds: number;
  angleOffset: number;
  speedScale: number;
  lengthScale: number;
  bulkScale: number;
}

function randomBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

const definition: ExperimentDefinition = {
  id: "meteor-shower",
  title: "Meteor Shower",
  category: "stars",
  blurb: "An endless stochastic drizzle of heavy meteors gouges channels through the stripes over a bulging starfield.",
  pointer: "custom",
  create: (ctx) => {
    let requestSurge: (() => void) | null = null;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, METEOR_SHOWER_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCanvasSize = gl.getUniformLocation(program, "uCanvasSize");
      const uRadiantDirection = gl.getUniformLocation(program, "uRadiantDirection");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uMeteorCount = gl.getUniformLocation(program, "uMeteorCount");
      const uMeteorOrigin = gl.getUniformLocation(program, "uMeteorOrigin[0]");
      const uMeteorShape = gl.getUniformLocation(program, "uMeteorShape[0]");
      const originUniforms = new Float32Array(METEOR_SHOWER_MAX_METEORS * 4);
      const shapeUniforms = new Float32Array(METEOR_SHOWER_MAX_METEORS * 4);
      const random = createSeededRng(0x6d657465);
      const meteors: MeteorState[] = [];
      let nextArrivalSeconds: number | null = null;
      let surgePending = false;

      const sampleInterval = () => {
        const uniform = Math.min(0.999999, Math.max(1e-6, random()));
        const exponential = -Math.log(1 - uniform) * MEAN_INTERVAL_SECONDS;
        return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, exponential));
      };

      const spawnMeteor = (bornAtSeconds: number) => {
        if (meteors.length >= METEOR_SHOWER_MAX_METEORS) {
          let oldestIndex = 0;
          for (let index = 1; index < meteors.length; index++) {
            if (meteors[index].bornAtSeconds < meteors[oldestIndex].bornAtSeconds) oldestIndex = index;
          }
          meteors.splice(oldestIndex, 1);
        }
        const fromBottomEdge = random() < 0.62;
        meteors.push({
          spawnX: fromBottomEdge ? randomBetween(random, -0.45, 1.05) : randomBetween(random, -0.42, -0.08),
          spawnY: fromBottomEdge ? randomBetween(random, 1.02, 1.34) : randomBetween(random, 0.3, 1.05),
          bornAtSeconds,
          lifetimeSeconds: randomBetween(random, 1.0, 2.4),
          angleOffset: randomBetween(random, (-14 * Math.PI) / 180, (14 * Math.PI) / 180),
          speedScale: randomBetween(random, 0.62, 1.45),
          lengthScale: randomBetween(random, 0.5, 1.4),
          bulkScale: randomBetween(random, 0.75, 1.7),
        });
      };

      const pruneMeteors = (elapsedSeconds: number) => {
        for (let index = meteors.length - 1; index >= 0; index--) {
          const meteor = meteors[index];
          if (elapsedSeconds - meteor.bornAtSeconds > meteor.lifetimeSeconds) meteors.splice(index, 1);
        }
      };

      const triggerSurge = () => {
        surgePending = true;
      };
      requestSurge = triggerSurge;

      return {
        render(frame) {
          const elapsedSeconds = frame.elapsed / 1000;
          pruneMeteors(elapsedSeconds);

          if (nextArrivalSeconds === null) nextArrivalSeconds = elapsedSeconds + sampleInterval() * 0.35;
          if (elapsedSeconds - nextArrivalSeconds > RESYNC_LAG_SECONDS) nextArrivalSeconds = elapsedSeconds;

          if (surgePending) {
            surgePending = false;
            spawnMeteor(elapsedSeconds);
            spawnMeteor(elapsedSeconds + randomBetween(random, 0.1, 0.45));
          }

          let spawned = 0;
          while (elapsedSeconds >= nextArrivalSeconds && spawned < MAX_SPAWNS_PER_FRAME) {
            spawnMeteor(nextArrivalSeconds);
            nextArrivalSeconds += sampleInterval();
            spawned++;
          }

          originUniforms.fill(0);
          shapeUniforms.fill(0);
          for (let index = 0; index < meteors.length; index++) {
            const meteor = meteors[index];
            const offset = index * 4;
            originUniforms[offset] = meteor.spawnX;
            originUniforms[offset + 1] = meteor.spawnY;
            originUniforms[offset + 2] = elapsedSeconds - meteor.bornAtSeconds;
            originUniforms[offset + 3] = meteor.lifetimeSeconds;
            shapeUniforms[offset] = meteor.angleOffset;
            shapeUniforms[offset + 1] = meteor.speedScale;
            shapeUniforms[offset + 2] = meteor.lengthScale;
            shapeUniforms[offset + 3] = meteor.bulkScale;
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
          quad.draw();
        },
        dispose() {
          if (requestSurge === triggerSurge) requestSurge = null;
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
      replay: () => requestSurge?.(),
      destroy: () => {
        disposed = true;
        image.onload = null;
        engine.dispose();
        requestSurge = null;
      },
    };
  },
};

export default definition;
