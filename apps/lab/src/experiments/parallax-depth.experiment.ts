import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";

const PARALLAX_DEPTH_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uFieldSize;
uniform vec2 uCanvasSize;
uniform vec2 uCursor;
uniform float uNow;
uniform float uGhostWeight;
in vec2 vUv;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float starLayer(
  vec2 fragCoord,
  float cellSize,
  float spawnThreshold,
  float starRadius,
  float layerBrightness,
  float driftSpeed,
  float parallaxFactor,
  vec2 cursorOff,
  vec2 canvasSize,
  float nowMs
) {
  vec2 drift = vec2(-nowMs * 0.001 * driftSpeed, 0.0);
  vec2 parallax = cursorOff * canvasSize * parallaxFactor;
  vec2 p = fragCoord + drift + parallax;
  vec2 id = floor(p / cellSize);
  vec2 gv = fract(p / cellSize) - 0.5;
  float sum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offs = vec2(float(x), float(y));
      vec2 cellId = id + offs;
      float h = hash21(cellId);
      if (h < spawnThreshold) continue;
      vec2 starLocal = vec2(hash21(cellId + 17.7), hash21(cellId + 43.1)) - 0.5;
      vec2 starPos = offs + starLocal * 0.82;
      float d = length(gv - starPos);
      float size = starRadius * (0.65 + 0.35 * hash21(cellId + 91.3));
      float phase = hash21(cellId + 127.9) * 6.2831853;
      float twinkleSpeed = 1.2 + hash21(cellId + 203.5) * 5.5;
      float twinkle = 0.5 + 0.5 * sin(nowMs * 0.001 * twinkleSpeed + phase);
      sum += smoothstep(size, size * 0.15, d) * layerBrightness * twinkle;
    }
  }
  return sum;
}

void main() {
  vec2 fragCoord = vUv * uFieldSize;
  vec2 cursorOff = uCursor - vec2(0.5);
  float ghost = texture(uField, vUv).r * uGhostWeight;
  float layer1 = starLayer(fragCoord, 76.0, 0.962, 0.24, 1.0, 2.0, 0.012, cursorOff, uCanvasSize, uNow);
  float layer2 = starLayer(fragCoord, 44.0, 0.885, 0.17, 0.58, 4.5, 0.03, cursorOff, uCanvasSize, uNow);
  float layer3 = starLayer(fragCoord, 26.0, 0.775, 0.12, 0.3, 8.0, 0.06, cursorOff, uCanvasSize, uNow);
  float stars = layer1 + layer2 + layer3;
  float value = min(1.0, ghost + stars);
  outColor = vec4(vec3(value), 1.0);
}
`;

const REPLAY_MS = 2500;
const SMOOTH = 0.08;
const GHOST_WEIGHT = 0.1;

const definition: ExperimentDefinition = {
  id: "parallax-depth",
  title: "Parallax Depth",
  category: "stars",
  blurb: "Three drifting star layers with cursor parallax and desynchronized twinkle over a faint image ghost.",
  pointer: "custom",
  create: (ctx) => {
    const pointer = { targetX: 0.5, targetY: 0.5 };
    const smooth = { x: 0.5, y: 0.5 };
    let replaying = false;
    let replayStartMs = 0;

    const toLocal = (e: PointerEvent) => {
      const rect = ctx.canvas.getBoundingClientRect();
      pointer.targetX = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.targetY = (e.clientY - rect.top) / Math.max(1, rect.height);
    };

    const onMove = (e: PointerEvent) => {
      if (replaying) return;
      toLocal(e);
    };

    ctx.canvas.addEventListener("pointermove", onMove);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, PARALLAX_DEPTH_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uFieldSize = gl.getUniformLocation(program, "uFieldSize");
      const uCanvasSize = gl.getUniformLocation(program, "uCanvasSize");
      const uCursor = gl.getUniformLocation(program, "uCursor");
      const uNow = gl.getUniformLocation(program, "uNow");
      const uGhostWeight = gl.getUniformLocation(program, "uGhostWeight");

      return {
        render(frame) {
          if (replaying) {
            const elapsed = frame.now - replayStartMs;
            if (elapsed >= REPLAY_MS) {
              replaying = false;
            } else {
              const t = elapsed / REPLAY_MS;
              pointer.targetX = 0.5 + 0.42 * Math.sin(t * Math.PI * 2);
              pointer.targetY = 0.5 + 0.18 * Math.sin(t * Math.PI * 3);
            }
          }

          smooth.x += (pointer.targetX - smooth.x) * SMOOTH;
          smooth.y += (pointer.targetY - smooth.y) * SMOOTH;

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uFieldSize, frame.fieldSize.width, frame.fieldSize.height);
          gl.uniform2f(uCanvasSize, frame.cssW, frame.cssH);
          gl.uniform2f(uCursor, smooth.x, smooth.y);
          gl.uniform1f(uNow, frame.now);
          gl.uniform1f(uGhostWeight, GHOST_WEIGHT);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
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
      replay: () => {
        replaying = true;
        replayStartMs = performance.now();
      },
      destroy: () => {
        disposed = true;
        ctx.canvas.removeEventListener("pointermove", onMove);
        engine.dispose();
      },
    };
  },
};

export default definition;
