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
import {
  arcPointX,
  arcPointY,
  arcTangentX,
  arcTangentY,
  samplePathPixels,
  standardEase,
  type CometArc,
} from "./comet-passage.path";
import { COMET_PASSAGE_FRAG, COMET_PASSAGE_MAX_COMETS, COMET_PASSAGE_PATH_POINTS } from "./comet-passage.shaders";

const FIELD_SCALE = 0.75;
const FIRST_LAUNCH_SECONDS = 1.4;
const MIN_GAP_SECONDS = 3;
const MAX_GAP_SECONDS = 6;
const MIN_CROSSING_SECONDS = 4.2;
const MAX_CROSSING_SECONDS = 7;
const COMPANION_CHANCE = 0.22;
const MIN_COMPANION_DELAY_SECONDS = 1.1;
const MAX_COMPANION_DELAY_SECONDS = 2.6;
const RESYNC_LAG_SECONDS = 3;
const PATH_HALF_SPAN = 1.35;
const TAIL_SPAN_UNITS = 0.62;
const NUCLEUS_RADIUS_PX = 16;
const FADE_IN_FRACTION = 0.1;
const FADE_OUT_FRACTION = 0.12;

interface CometState {
  arc: CometArc;
  bornAtSeconds: number;
  durationSeconds: number;
  radiusScale: number;
  tailWidthScale: number;
}

function randomBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

const definition: ExperimentDefinition = {
  id: "comet-passage",
  title: "Comet Passage",
  category: "stars",
  blurb:
    "Once every several seconds a single heavy comet drifts across the stripes on a curved path, dragging a long tapering tail.",
  pointer: "custom",
  create: (ctx) => {
    let requestLaunch: (() => void) | null = null;

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, COMET_PASSAGE_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uCometCount = gl.getUniformLocation(program, "uCometCount");
      const uCometHead = gl.getUniformLocation(program, "uCometHead[0]");
      const uCometShape = gl.getUniformLocation(program, "uCometShape[0]");
      const uCometBound = gl.getUniformLocation(program, "uCometBound[0]");
      const uPath = gl.getUniformLocation(program, "uPath[0]");

      const headUniforms = new Float32Array(COMET_PASSAGE_MAX_COMETS * 4);
      const shapeUniforms = new Float32Array(COMET_PASSAGE_MAX_COMETS * 4);
      const boundUniforms = new Float32Array(COMET_PASSAGE_MAX_COMETS * 3);
      const pathUniforms = new Float32Array(COMET_PASSAGE_MAX_COMETS * COMET_PASSAGE_PATH_POINTS * 2);

      const random = createSeededRng(0x636f6d74);
      const comets: CometState[] = [];
      let nextLaunchSeconds: number | null = null;
      let companionAtSeconds: number | null = null;
      let launchPending = false;

      const buildComet = (bornAtSeconds: number, sizeScale: number): CometState => {
        const tilt = randomBetween(random, (-26 * Math.PI) / 180, (26 * Math.PI) / 180);
        const lateralSign = random() < 0.5 ? 1 : -1;
        const directionX = Math.sin(tilt) * lateralSign;
        const directionY = -Math.cos(tilt);
        const normalX = -directionY;
        const normalY = directionX;
        const lateralOffset = randomBetween(random, -0.32, 0.32);
        const bend = randomBetween(random, 0.09, 0.2) * (random() < 0.5 ? 1 : -1);
        const centerX = 0.5 + normalX * lateralOffset;
        const centerY = 0.5 + normalY * lateralOffset;
        return {
          arc: {
            startX: centerX - directionX * PATH_HALF_SPAN,
            startY: centerY - directionY * PATH_HALF_SPAN,
            controlX: centerX + normalX * bend * 2,
            controlY: centerY + normalY * bend * 2,
            endX: centerX + directionX * PATH_HALF_SPAN,
            endY: centerY + directionY * PATH_HALF_SPAN,
          },
          bornAtSeconds,
          durationSeconds: randomBetween(random, MIN_CROSSING_SECONDS, MAX_CROSSING_SECONDS),
          radiusScale: randomBetween(random, 0.88, 1.24) * sizeScale,
          tailWidthScale: randomBetween(random, 0.9, 1.15),
        };
      };

      const launchComet = (bornAtSeconds: number, sizeScale: number) => {
        if (comets.length >= COMET_PASSAGE_MAX_COMETS) return;
        comets.push(buildComet(bornAtSeconds, sizeScale));
      };

      const triggerLaunch = () => {
        launchPending = true;
      };
      requestLaunch = triggerLaunch;

      return {
        render(frame) {
          const elapsedSeconds = frame.elapsed / 1000;
          const width = Math.max(1, frame.cssW);
          const height = Math.max(1, frame.cssH);

          for (let index = comets.length - 1; index >= 0; index--) {
            const comet = comets[index];
            if (elapsedSeconds - comet.bornAtSeconds > comet.durationSeconds) comets.splice(index, 1);
          }

          if (nextLaunchSeconds === null) nextLaunchSeconds = elapsedSeconds + FIRST_LAUNCH_SECONDS;
          if (elapsedSeconds - nextLaunchSeconds > RESYNC_LAG_SECONDS) nextLaunchSeconds = elapsedSeconds;

          if (launchPending) {
            launchPending = false;
            launchComet(elapsedSeconds, 1);
          }

          if (elapsedSeconds >= nextLaunchSeconds) {
            launchComet(nextLaunchSeconds, 1);
            companionAtSeconds =
              random() < COMPANION_CHANCE
                ? nextLaunchSeconds + randomBetween(random, MIN_COMPANION_DELAY_SECONDS, MAX_COMPANION_DELAY_SECONDS)
                : null;
            nextLaunchSeconds += randomBetween(random, MIN_GAP_SECONDS, MAX_GAP_SECONDS);
          }

          if (companionAtSeconds !== null && elapsedSeconds >= companionAtSeconds) {
            launchComet(companionAtSeconds, 0.72);
            companionAtSeconds = null;
          }

          headUniforms.fill(0);
          shapeUniforms.fill(0);
          boundUniforms.fill(0);
          pathUniforms.fill(0);

          const tailSpan = TAIL_SPAN_UNITS / (2 * PATH_HALF_SPAN);
          for (let index = 0; index < comets.length; index++) {
            const comet = comets[index];
            const progress = (elapsedSeconds - comet.bornAtSeconds) / comet.durationSeconds;
            const fadeIn = standardEase(progress / FADE_IN_FRACTION);
            const fadeOut = 1 - standardEase((progress - (1 - FADE_OUT_FRACTION)) / FADE_OUT_FRACTION);
            const presence = Math.max(0, fadeIn * fadeOut);

            const pathOffset = index * COMET_PASSAGE_PATH_POINTS * 2;
            samplePathPixels(
              comet.arc,
              progress,
              tailSpan,
              COMET_PASSAGE_PATH_POINTS,
              width,
              height,
              pathUniforms,
              pathOffset,
            );

            const headX = arcPointX(comet.arc, progress) * width;
            const headY = arcPointY(comet.arc, progress) * height;
            const tangentX = arcTangentX(comet.arc, progress) * width;
            const tangentY = arcTangentY(comet.arc, progress) * height;
            const tangentLength = Math.max(1e-4, Math.hypot(tangentX, tangentY));
            const radiusPx = NUCLEUS_RADIUS_PX * comet.radiusScale;

            const headSlot = index * 4;
            headUniforms[headSlot] = headX;
            headUniforms[headSlot + 1] = headY;
            headUniforms[headSlot + 2] = presence;
            headUniforms[headSlot + 3] = 0;
            shapeUniforms[headSlot] = tangentX / tangentLength;
            shapeUniforms[headSlot + 1] = tangentY / tangentLength;
            shapeUniforms[headSlot + 2] = radiusPx;
            shapeUniforms[headSlot + 3] = comet.tailWidthScale;

            let minX = pathUniforms[pathOffset];
            let maxX = minX;
            let minY = pathUniforms[pathOffset + 1];
            let maxY = minY;
            for (let point = 1; point < COMET_PASSAGE_PATH_POINTS; point++) {
              const px = pathUniforms[pathOffset + point * 2];
              const py = pathUniforms[pathOffset + point * 2 + 1];
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            }
            const boundSlot = index * 3;
            boundUniforms[boundSlot] = (minX + maxX) * 0.5;
            boundUniforms[boundSlot + 1] = (minY + maxY) * 0.5;
            boundUniforms[boundSlot + 2] = Math.hypot(maxX - minX, maxY - minY) * 0.5 + radiusPx * 5 + 24;
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, width, height);
          gl.uniform1f(uTime, elapsedSeconds);
          gl.uniform1i(uCometCount, comets.length);
          gl.uniform4fv(uCometHead, headUniforms);
          gl.uniform4fv(uCometShape, shapeUniforms);
          gl.uniform3fv(uCometBound, boundUniforms);
          gl.uniform2fv(uPath, pathUniforms);
          quad.draw();
        },
        dispose() {
          if (requestLaunch === triggerLaunch) requestLaunch = null;
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
      replay: () => requestLaunch?.(),
      destroy: () => {
        disposed = true;
        image.onload = null;
        engine.dispose();
        requestLaunch = null;
      },
    };
  },
};

export default definition;
