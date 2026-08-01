import { advanceCometLogoAnimation, createCometLogoAnimationState, type CometLogoAnimationState } from "./animation";
import { normalizeCometLogoSettings, type CometLogoSettings } from "./config";
import {
  COMET_LOGO_ACTIVE_RENDER_POINT_COUNT,
  COMET_LOGO_IDLE_RENDER_POINT_COUNT,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
} from "./points";
import { COMET_LOGO_FRAGMENT_SHADER, COMET_LOGO_VERTEX_SHADER } from "./shaders";

export const COMET_LOGO_RENDER_SCALE = 0.5;

export type CometLogoPointer = {
  x: number;
  y: number;
  hovered: boolean;
};

export type CometLogoTextureRenderer = {
  canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  resize(width: number, height: number): void;
  render(timeSec: number, pointer: CometLogoPointer, settings?: Partial<CometLogoSettings>): void;
  getAnimationState(): Readonly<CometLogoAnimationState>;
  dispose(): void;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create comet logo shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || "Unknown comet logo shader compile error.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, COMET_LOGO_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, COMET_LOGO_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create comet logo shader program.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || "Unknown comet logo shader link error.";
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
}

export function createCometLogoTextureRenderer(width: number, height: number): CometLogoTextureRenderer {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) throw new Error("WebGL2 is required for the comet logo shader.");

  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  if (!vao) {
    gl.deleteProgram(program);
    throw new Error("Could not create comet logo vertex array.");
  }

  const resolutionLoc = gl.getUniformLocation(program, "uResolution");
  const fieldTimeLoc = gl.getUniformLocation(program, "uFieldTime");
  const formationLoc = gl.getUniformLocation(program, "uFormation");
  const rejoiningLoc = gl.getUniformLocation(program, "uRejoining");
  const rejoinProgressLoc = gl.getUniformLocation(program, "uRejoinProgress");
  const rejoinElapsedLoc = gl.getUniformLocation(program, "uRejoinElapsed");
  const rejoinStartFieldTimeLoc = gl.getUniformLocation(program, "uRejoinStartFieldTime");
  const rejoinStartFormationLoc = gl.getUniformLocation(program, "uRejoinStartFormation");
  const rejoinDurationLoc = gl.getUniformLocation(program, "uRejoinDuration");
  const formationOriginLoc = gl.getUniformLocation(program, "uFormationOrigin");
  const formationStartFieldTimeLoc = gl.getUniformLocation(program, "uFormationStartFieldTime");
  const configUniforms = Object.fromEntries(
    [
      "FieldSpeed",
      "FieldDepth",
      "FieldSpread",
      "CenterClearRadius",
      "FieldTrailLength",
      "FieldParticleSize",
      "LogoScale",
      "LogoParticleSize",
      "LogoTrailLength",
      "LogoMotion",
      "FormationDuration",
      "FormationStagger",
      "CenterPreference",
      "SparkFrequency",
      "SparkSize",
      "SparkBrightness",
      "SparkTrailLength",
      "BurstProbability",
      "WaveProbability",
      "SurfaceEffects",
      "FireScale",
      "FireIntensity",
      "FireSpeed",
      "FireTurbulence",
      "FlameHeight",
      "WeatherSpeed",
      "WeatherVariation",
      "CoronaMist",
      "CurlingWisps",
      "HotRim",
      "EruptionFrequency",
      "EruptionScale",
      "EruptionIntensity",
      "EruptionParticles",
      "EruptionCycleSpeed",
    ].map((name) => [name, gl.getUniformLocation(program, `u${name}`)]),
  );
  let animation = createCometLogoAnimationState();
  let formationOriginX = 0.5;
  let formationOriginY = 0.5;
  let formationStartFieldTimeSec = 0;
  let disposed = false;

  const resize = (nextWidth: number, nextHeight: number) => {
    const w = Math.max(1, Math.round(nextWidth * COMET_LOGO_RENDER_SCALE));
    const h = Math.max(1, Math.round(nextHeight * COMET_LOGO_RENDER_SCALE));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };
  resize(width, height);

  return {
    canvas,
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
    resize,
    render(timeSec, pointer, inputSettings) {
      if (disposed) return;
      const settings = normalizeCometLogoSettings(inputSettings);
      const previousMode = animation.mode;
      animation = advanceCometLogoAnimation(
        animation,
        timeSec,
        pointer.hovered,
        settings.formationDuration,
        settings.rejoinDuration,
      );
      if (animation.mode === "forming" && previousMode !== "forming") {
        formationOriginX = Math.max(0, Math.min(1, pointer.x / Math.max(1, canvas.width)));
        formationOriginY = Math.max(0, Math.min(1, pointer.y / Math.max(1, canvas.height)));
        formationStartFieldTimeSec = animation.fieldTimeSec;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(fieldTimeLoc, animation.fieldTimeSec);
      gl.uniform1f(formationLoc, animation.formation);
      gl.uniform1f(rejoiningLoc, animation.mode === "rejoining" ? 1 : 0);
      gl.uniform1f(rejoinProgressLoc, animation.rejoinProgress);
      gl.uniform1f(rejoinElapsedLoc, Math.max(0, animation.fieldTimeSec - animation.rejoinStartFieldTimeSec));
      gl.uniform1f(rejoinStartFieldTimeLoc, animation.rejoinStartFieldTimeSec);
      gl.uniform1f(rejoinStartFormationLoc, animation.rejoinStartFormation);
      gl.uniform1f(rejoinDurationLoc, settings.rejoinDuration);
      gl.uniform2f(formationOriginLoc, formationOriginX * canvas.width, formationOriginY * canvas.height);
      gl.uniform1f(formationStartFieldTimeLoc, formationStartFieldTimeSec);
      const uniformValues: Record<string, number> = {
        FieldSpeed: settings.fieldSpeed,
        FieldDepth: settings.fieldDepth,
        FieldSpread: settings.fieldSpread,
        CenterClearRadius: settings.centerClearRadius * COMET_LOGO_RENDER_SCALE,
        FieldTrailLength: settings.fieldTrailLength,
        FieldParticleSize: settings.fieldParticleSize,
        LogoScale: settings.logoScale,
        LogoParticleSize: settings.logoParticleSize,
        LogoTrailLength: settings.logoTrailLength,
        LogoMotion: settings.logoMotion,
        FormationDuration: settings.formationDuration,
        FormationStagger: settings.formationStagger,
        CenterPreference: settings.centerPreference,
        SparkFrequency: settings.sparkFrequency,
        SparkSize: settings.sparkSize,
        SparkBrightness: settings.sparkBrightness,
        SparkTrailLength: settings.sparkTrailLength,
        BurstProbability: settings.burstProbability,
        WaveProbability: settings.waveProbability,
        SurfaceEffects: settings.surfaceEffects,
        FireScale: settings.fireScale,
        FireIntensity: settings.fireIntensity,
        FireSpeed: settings.fireSpeed,
        FireTurbulence: settings.fireTurbulence,
        FlameHeight: settings.flameHeight,
        WeatherSpeed: settings.weatherSpeed,
        WeatherVariation: settings.weatherVariation,
        CoronaMist: settings.coronaMist,
        CurlingWisps: settings.curlingWisps,
        HotRim: settings.hotRim,
        EruptionFrequency: settings.eruptionFrequency,
        EruptionScale: settings.eruptionScale,
        EruptionIntensity: settings.eruptionIntensity,
        EruptionParticles: settings.eruptionParticles,
        EruptionCycleSpeed: settings.eruptionCycleSpeed,
      };
      for (const [name, value] of Object.entries(uniformValues)) {
        gl.uniform1f(configUniforms[name] ?? null, value);
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const renderPointCount =
        animation.mode === "field" ? COMET_LOGO_IDLE_RENDER_POINT_COUNT : COMET_LOGO_ACTIVE_RENDER_POINT_COUNT;
      gl.drawArraysInstanced(gl.TRIANGLES, 0, COMET_LOGO_TRAIL_SEGMENT_COUNT * 6, renderPointCount);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    getAnimationState() {
      return animation;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
