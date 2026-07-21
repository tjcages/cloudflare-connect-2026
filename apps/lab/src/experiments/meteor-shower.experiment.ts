import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";

const METEOR_SHOWER_FRAG = `#version 300 es
precision highp float;
const int MAX_METEORS = 8;
uniform sampler2D uField;
uniform vec2 uCanvasSize;
uniform vec2 uRadiantDirection;
uniform float uTime;
uniform int uMeteorCount;
uniform vec4 uMeteors[MAX_METEORS];
in vec2 vUv;
out vec4 outColor;

float hash11(float value) {
  return fract(sin(value * 127.1) * 43758.5453123);
}

float hash21(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 rotateVector(vec2 value, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return vec2(cosine * value.x - sine * value.y, sine * value.x + cosine * value.y);
}

float baseStarfield(vec2 point) {
  const float cellSize = 23.0;
  vec2 cellId = floor(point / cellSize);
  vec2 cellUv = fract(point / cellSize);
  float seed = hash21(cellId + 17.0);
  float occupancy = step(0.68, seed);
  vec2 position = vec2(hash21(cellId + vec2(31.7, 11.3)), hash21(cellId + vec2(7.1, 53.9)));
  position = 0.17 + position * 0.66;
  float distanceToStar = length((cellUv - position) * cellSize);
  float radius = mix(0.9, 1.9, hash21(cellId + 91.7));
  float core = 1.0 - smoothstep(radius, radius + 0.9, distanceToStar);
  float halo = exp(-(distanceToStar * distanceToStar) / max(0.001, radius * radius * 6.0)) * 0.16;
  float phase = hash21(cellId + 127.3) * 6.2831853;
  float speed = mix(0.45, 1.1, hash21(cellId + 203.5));
  float twinkle = 0.86 + 0.14 * sin(uTime * speed + phase);
  return occupancy * (core * 0.55 + halo) * twinkle;
}

float meteorLight(vec2 point, vec4 meteor, float diagonal) {
  float age = meteor.z;
  float seed = meteor.w;
  float lifetime = mix(0.9, 1.6, hash11(seed + 11.7));
  float alive = step(0.0, age) * (1.0 - step(lifetime, age));
  float fadeIn = smoothstep(0.0, 0.1, age);
  float fadeOut = 1.0 - smoothstep(max(0.0, lifetime - 0.26), lifetime, age);
  float angleJitter = radians(mix(-8.0, 8.0, hash11(seed + 29.1)));
  vec2 direction = rotateVector(normalize(uRadiantDirection), angleJitter);
  float speed = diagonal * 0.55 * mix(0.6, 1.4, hash11(seed + 47.3));
  float tailLength = diagonal * 0.18 * mix(0.6, 1.4, hash11(seed + 83.9));
  float visibleAge = max(0.0, age);
  vec2 head = meteor.xy * uCanvasSize + direction * speed * visibleAge;
  vec2 relative = point - head;
  float visibleTailLength = min(tailLength, speed * visibleAge);
  float behindHead = clamp(-dot(relative, direction), 0.0, visibleTailLength);
  float tailProgress = behindHead / max(1.0, tailLength);
  float distanceToCapsule = length(relative + direction * behindHead);
  float headRadius = max(1.5, diagonal * 0.0032);
  float tailWidth = mix(headRadius * 0.72, 0.35, pow(clamp(tailProgress, 0.0, 1.0), 0.65));
  float capsule = 1.0 - smoothstep(tailWidth, tailWidth + 1.0, distanceToCapsule);
  float tail = capsule * exp(-4.6 * tailProgress) * 0.78;
  float headDistance = length(relative);
  float headCore = 1.0 - smoothstep(headRadius * 0.18, headRadius, headDistance);
  float bloomRadius = headRadius * 3.4;
  float bloom = exp(-(headDistance * headDistance) / (bloomRadius * bloomRadius)) * 0.3;
  return (tail + headCore * 1.15 + bloom) * alive * fadeIn * fadeOut;
}

void main() {
  vec2 point = vUv * uCanvasSize;
  float diagonal = length(uCanvasSize);
  float stars = baseStarfield(point);
  float meteors = 0.0;
  for (int index = 0; index < MAX_METEORS; index++) {
    if (index >= uMeteorCount) break;
    meteors += meteorLight(point, uMeteors[index], diagonal);
  }
  float imageGhost = texture(uField, vUv).r * 0.08;
  float value = clamp(max(imageGhost, stars) + meteors, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

const MAX_METEORS = 8;
const MAX_LIFETIME_SECONDS = 1.6;
const GUST_WINDOW_SECONDS = 0.8;
const FIELD_SCALE = 0.75;
const RADIANT_ANGLE_RADIANS = (-35 * Math.PI) / 180;
const RADIANT_X = Math.cos(RADIANT_ANGLE_RADIANS);
const RADIANT_Y = Math.sin(RADIANT_ANGLE_RADIANS);

interface MeteorState {
  spawnX: number;
  spawnY: number;
  bornAtSeconds: number;
  seed: number;
}

function randomBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

const definition: ExperimentDefinition = {
  id: "meteor-shower",
  title: "Meteor Shower",
  category: "stars",
  blurb: "A quiet starfield releases loose gusts of radiant meteors with softly fading tails.",
  pointer: "custom",
  create: (ctx) => {
    let requestDenseGust: (() => void) | null = null;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, METEOR_SHOWER_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCanvasSize = gl.getUniformLocation(program, "uCanvasSize");
      const uRadiantDirection = gl.getUniformLocation(program, "uRadiantDirection");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uMeteorCount = gl.getUniformLocation(program, "uMeteorCount");
      const uMeteors = gl.getUniformLocation(program, "uMeteors[0]");
      const meteorUniforms = new Float32Array(MAX_METEORS * 4);
      const random = createSeededRng(0x6d657465);
      const meteors: MeteorState[] = [];
      let nextGustAtSeconds: number | null = null;
      let denseGustPending = false;

      const pruneMeteors = (elapsedSeconds: number) => {
        for (let index = meteors.length - 1; index >= 0; index--) {
          if (elapsedSeconds - meteors[index].bornAtSeconds > MAX_LIFETIME_SECONDS) meteors.splice(index, 1);
        }
      };

      const makeRoom = (count: number) => {
        const excess = Math.max(0, meteors.length + count - MAX_METEORS);
        if (excess === 0) return;
        meteors.sort((a, b) => a.bornAtSeconds - b.bornAtSeconds);
        meteors.splice(0, excess);
      };

      const spawnGust = (elapsedSeconds: number, count: number, dense: boolean) => {
        const duration = dense ? 0.56 : randomBetween(random, GUST_WINDOW_SECONDS * 0.72, GUST_WINDOW_SECONDS);
        const delays: number[] = [];
        for (let index = 0; index < count; index++) {
          const position = count === 1 ? 0 : index / (count - 1);
          const jitter = index === 0 || index === count - 1 ? 0 : randomBetween(random, -0.07, 0.07);
          delays.push(Math.min(duration, Math.max(0, duration * position + jitter)));
        }
        delays.sort((a, b) => a - b);
        makeRoom(count);
        for (const delay of delays) {
          meteors.push({
            spawnX: -0.12 + Math.pow(random(), 1.5) * 0.5,
            spawnY: randomBetween(random, 0.7, 1.08),
            bornAtSeconds: elapsedSeconds + delay,
            seed: randomBetween(random, 1, 4095),
          });
        }
        return delays[delays.length - 1] ?? 0;
      };

      const triggerDenseGust = () => {
        denseGustPending = true;
      };
      requestDenseGust = triggerDenseGust;

      return {
        render(frame) {
          const elapsedSeconds = frame.elapsed / 1000;
          pruneMeteors(elapsedSeconds);
          if (nextGustAtSeconds === null) nextGustAtSeconds = elapsedSeconds + randomBetween(random, 0.7, 1.5);

          if (denseGustPending) {
            denseGustPending = false;
            const finalDelay = spawnGust(elapsedSeconds, 4, true);
            nextGustAtSeconds = elapsedSeconds + finalDelay + randomBetween(random, 4, 9);
          } else if (elapsedSeconds >= nextGustAtSeconds) {
            const count = 2 + Math.floor(random() * 3);
            const finalDelay = spawnGust(elapsedSeconds, count, false);
            nextGustAtSeconds = elapsedSeconds + finalDelay + randomBetween(random, 4, 9);
          }

          meteorUniforms.fill(0);
          for (let index = 0; index < meteors.length; index++) {
            const meteor = meteors[index];
            const offset = index * 4;
            meteorUniforms[offset] = meteor.spawnX;
            meteorUniforms[offset + 1] = meteor.spawnY;
            meteorUniforms[offset + 2] = elapsedSeconds - meteor.bornAtSeconds;
            meteorUniforms[offset + 3] = meteor.seed;
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
          gl.uniform4fv(uMeteors, meteorUniforms);
          quad.draw();
        },
        dispose() {
          if (requestDenseGust === triggerDenseGust) requestDenseGust = null;
          gl.deleteProgram(program);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { fieldScale: FIELD_SCALE, hooks: { fieldPass } });
    engine.setConfig({
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
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
      replay: () => requestDenseGust?.(),
      destroy: () => {
        disposed = true;
        image.onload = null;
        engine.dispose();
        requestDenseGust = null;
      },
    };
  },
};

export default definition;
