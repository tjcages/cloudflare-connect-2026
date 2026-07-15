import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  GLSL3,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { CONNECT_SHADER_DEFAULTS, type ConnectShaderConfig, type ConnectShapeType } from "./config";
import {
  CONNECT_BASE_FRAGMENT,
  CONNECT_EMITTER_FRAGMENT,
  CONNECT_EMITTER_VERTEX,
  CONNECT_HATCH_FRAGMENT,
  CONNECT_SHADER_NOISE_UTILS,
  CONNECT_SHADER_VERTEX,
} from "./fragment";
import { buildConnectGeometry, connectShapeParams, sampleConnectSurface } from "./geometry";
import {
  CONNECT_GEOMETRY_PARAM_KEYS,
  CONNECT_SHADER_PARAM_DEFAULTS,
  normalizeConnectShaderParams,
  type ConnectShaderParams,
} from "./params";

export type ConnectCameraState = {
  distance: number;
  rotateXDeg: number;
  rotateYDeg: number;
  rotateZDeg: number;
  panX: number;
  panY: number;
  fov: number;
};

export const CONNECT_CAMERA_DEFAULTS: ConnectCameraState = {
  distance: 60,
  rotateXDeg: -14.922460937499977,
  rotateYDeg: -180,
  rotateZDeg: 77,
  panX: 4.75,
  panY: 4.25,
  fov: CONNECT_SHADER_DEFAULTS.cameraFov,
};

const CAMERA_DISTANCE_MIN = 0.5;
const CAMERA_DISTANCE_MAX = 120;
const CAMERA_ROTATE_X_MIN = -89;
const CAMERA_ROTATE_X_MAX = 89;
const CAMERA_PAN_MIN = -40;
const CAMERA_PAN_MAX = 40;
const CAMERA_FOV_MIN = 20;
const CAMERA_FOV_MAX = 110;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeYawDeg(value: number): number {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

export function normalizeConnectCameraState(partial?: Partial<ConnectCameraState> | null): ConnectCameraState {
  return {
    distance: clamp(
      typeof partial?.distance === "number" && Number.isFinite(partial.distance)
        ? partial.distance
        : CONNECT_CAMERA_DEFAULTS.distance,
      CAMERA_DISTANCE_MIN,
      CAMERA_DISTANCE_MAX,
    ),
    rotateXDeg: clamp(
      typeof partial?.rotateXDeg === "number" && Number.isFinite(partial.rotateXDeg)
        ? partial.rotateXDeg
        : CONNECT_CAMERA_DEFAULTS.rotateXDeg,
      CAMERA_ROTATE_X_MIN,
      CAMERA_ROTATE_X_MAX,
    ),
    rotateYDeg: normalizeYawDeg(
      typeof partial?.rotateYDeg === "number" && Number.isFinite(partial.rotateYDeg)
        ? partial.rotateYDeg
        : CONNECT_CAMERA_DEFAULTS.rotateYDeg,
    ),
    rotateZDeg: normalizeYawDeg(
      typeof partial?.rotateZDeg === "number" && Number.isFinite(partial.rotateZDeg)
        ? partial.rotateZDeg
        : CONNECT_CAMERA_DEFAULTS.rotateZDeg,
    ),
    panX: clamp(
      typeof partial?.panX === "number" && Number.isFinite(partial.panX) ? partial.panX : CONNECT_CAMERA_DEFAULTS.panX,
      CAMERA_PAN_MIN,
      CAMERA_PAN_MAX,
    ),
    panY: clamp(
      typeof partial?.panY === "number" && Number.isFinite(partial.panY) ? partial.panY : CONNECT_CAMERA_DEFAULTS.panY,
      CAMERA_PAN_MIN,
      CAMERA_PAN_MAX,
    ),
    fov: clamp(
      typeof partial?.fov === "number" && Number.isFinite(partial.fov) ? partial.fov : CONNECT_CAMERA_DEFAULTS.fov,
      CAMERA_FOV_MIN,
      CAMERA_FOV_MAX,
    ),
  };
}

export type ConnectTextureRenderer = {
  canvas: HTMLCanvasElement;
  /** Fill-only gradient pass for display behind the stripes engine. */
  underlayCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  setShape(shapeType: ConnectShapeType): void;
  setParams(params: Partial<ConnectShaderParams>): ConnectShaderParams;
  getParams(): ConnectShaderParams;
  setCamera(state: Partial<ConnectCameraState>): ConnectCameraState;
  getCamera(): ConnectCameraState;
  orbit(deltaRotateYDeg: number, deltaRotateXDeg: number): ConnectCameraState;
  zoom(factor: number): ConnectCameraState;
  resetCamera(): ConnectCameraState;
  resize(width: number, height: number): void;
  render(timeSec: number): void;
  dispose(): void;
};

type UniformSlot<T> = { value: T };

function createSharedUniforms(config: ConnectShaderConfig) {
  return {
    uTime: { value: 0 } as UniformSlot<number>,
    uWavesX: { value: config.wavesX } as UniformSlot<number>,
    uWavesY: { value: config.wavesY } as UniformSlot<number>,
    uSpeedX: { value: config.speedX } as UniformSlot<number>,
    uSpeedY: { value: config.speedY } as UniformSlot<number>,
    uDisplacementHeight: { value: config.displacementHeight } as UniformSlot<number>,
    uPlaneW: { value: config.shapeWidth } as UniformSlot<number>,
    uPlaneH: { value: config.cylinderLength } as UniformSlot<number>,
    uFillColor: { value: new Color(config.fillColor) } as UniformSlot<Color>,
    uFillColor2: { value: new Color(config.fillColor2) } as UniformSlot<Color>,
    uFillGradScale: { value: config.fillGradScale } as UniformSlot<number>,
    uFillAlpha: { value: config.fillAlpha } as UniformSlot<number>,
    uFillLow: { value: config.fillLow } as UniformSlot<number>,
    uFillHigh: { value: config.fillHigh } as UniformSlot<number>,
    uFillRadius: { value: config.fillRadius } as UniformSlot<number>,
    uLineColor: { value: new Color(config.lineColor) } as UniformSlot<Color>,
    uLineCount: { value: config.lineCount } as UniformSlot<number>,
    uLineWidth: { value: config.lineWidth } as UniformSlot<number>,
    uLineAlpha: { value: config.lineAlpha } as UniformSlot<number>,
    uLineFadeLow: { value: config.lineFadeLow } as UniformSlot<number>,
    uLineFadeHigh: { value: config.lineFadeHigh } as UniformSlot<number>,
    uHatchAngle: { value: config.hatchAngle } as UniformSlot<number>,
    uHatchSpacing: { value: config.hatchSpacing } as UniformSlot<number>,
    uHatchCell: { value: config.hatchCell } as UniformSlot<number>,
    uHatchFill: { value: config.hatchFill } as UniformSlot<number>,
    uDashMin: { value: config.dashMin } as UniformSlot<number>,
    uDashMax: { value: config.dashMax } as UniformSlot<number>,
    uHatchDensity: { value: config.hatchDensity } as UniformSlot<number>,
    uDensityFloor: { value: config.densityFloor } as UniformSlot<number>,
    uHatchDrift: { value: config.hatchDrift } as UniformSlot<number>,
    uWaveGate: { value: config.waveGate } as UniformSlot<number>,
    uEnvCenter: { value: config.envCenter } as UniformSlot<number>,
    uEnvSlope: { value: config.envSlope } as UniformSlot<number>,
    uEnvWidth: { value: config.envWidth } as UniformSlot<number>,
    uPaleColor: { value: new Color(config.paleColor) } as UniformSlot<Color>,
    uSalmonColor: { value: new Color(config.salmonColor) } as UniformSlot<Color>,
    uOrangeColor: { value: new Color(config.orangeColor) } as UniformSlot<Color>,
    uAmberColor: { value: new Color(config.amberColor) } as UniformSlot<Color>,
    uDeepColor: { value: new Color(config.deepColor) } as UniformSlot<Color>,
  };
}

function buildEmitterGeometry(config: ConnectShaderConfig): BufferGeometry {
  const shapeParams = connectShapeParams(config);
  const count = Math.max(1, Math.round(config.emitCount));
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const tangents = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const rand = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const u = Math.random();
    const w = Math.random();
    const sample = sampleConnectSurface(shapeParams, u, w);
    positions.set(sample.position.toArray(), i * 3);
    normals.set(sample.normal.toArray(), i * 3);
    tangents.set(sample.tangent.toArray(), i * 3);
    uvs.set(sample.uv, i * 2);
    rand.set([Math.random(), Math.random(), Math.random()], i * 3);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(positions, 3));
  geom.setAttribute("normal", new BufferAttribute(normals, 3));
  geom.setAttribute("aTangent", new BufferAttribute(tangents, 3));
  geom.setAttribute("uv", new BufferAttribute(uvs, 2));
  geom.setAttribute("aRand", new BufferAttribute(rand, 3));
  return geom;
}

export function createConnectTextureRenderer(
  width: number,
  height: number,
  initialShape: ConnectShapeType = CONNECT_SHADER_DEFAULTS.shapeType,
  initialCamera?: Partial<ConnectCameraState> | null,
  initialParams?: Partial<ConnectShaderParams> | null,
): ConnectTextureRenderer {
  const params = normalizeConnectShaderParams({
    ...CONNECT_SHADER_PARAM_DEFAULTS,
    ...initialParams,
  });
  const config: ConnectShaderConfig = {
    ...CONNECT_SHADER_DEFAULTS,
    ...params,
    shapeType: initialShape,
  };
  let cameraState = normalizeConnectCameraState(initialCamera);

  const canvas = document.createElement("canvas");
  const underlayCanvas = document.createElement("canvas");
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  canvas.width = w;
  canvas.height = h;
  underlayCanvas.width = w;
  underlayCanvas.height = h;
  const underlayCtx = underlayCanvas.getContext("2d");

  const renderer = new WebGLRenderer({
    canvas,
    antialias: config.renderAntialias,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.setClearColor(0xffffff, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(cameraState.fov, w / Math.max(1, h), 0.1, 500);

  const applyCameraState = (next: ConnectCameraState) => {
    cameraState = normalizeConnectCameraState(next);
    const pitch = (cameraState.rotateXDeg * Math.PI) / 180;
    const yaw = (cameraState.rotateYDeg * Math.PI) / 180;
    const roll = (cameraState.rotateZDeg * Math.PI) / 180;
    const cosPitch = Math.cos(pitch);
    // Pan X/Y are swapped vs world axes so the sliders match the Connect framing.
    const targetX = cameraState.panY;
    const targetY = cameraState.panX;
    camera.position.set(
      targetX + cameraState.distance * cosPitch * Math.sin(yaw),
      targetY + cameraState.distance * Math.sin(pitch),
      cameraState.distance * cosPitch * Math.cos(yaw),
    );
    camera.fov = cameraState.fov;
    camera.lookAt(targetX, targetY, 0);
    if (roll !== 0) camera.rotateZ(roll);
    camera.updateProjectionMatrix();
    return cameraState;
  };

  applyCameraState(cameraState);

  const shared = createSharedUniforms(config);
  const hatchLiftSlot: UniformSlot<number> = { value: config.hatchLift };

  const baseMaterial = new ShaderMaterial({
    glslVersion: GLSL3,
    uniforms: { ...shared, uLift: { value: 0 } },
    vertexShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_SHADER_VERTEX}`,
    fragmentShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_BASE_FRAGMENT}`,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });

  const hatchMaterial = new ShaderMaterial({
    glslVersion: GLSL3,
    uniforms: { ...shared, uLift: hatchLiftSlot },
    vertexShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_SHADER_VERTEX}`,
    fragmentShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_HATCH_FRAGMENT}`,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });

  const emitUniforms = {
    uTime: { value: 0 } as UniformSlot<number>,
    uWavesX: { value: config.wavesX } as UniformSlot<number>,
    uWavesY: { value: config.wavesY } as UniformSlot<number>,
    uSpeedX: { value: config.speedX } as UniformSlot<number>,
    uSpeedY: { value: config.speedY } as UniformSlot<number>,
    uDisplacementHeight: { value: config.displacementHeight } as UniformSlot<number>,
    uEmitAmount: { value: config.emitAmount } as UniformSlot<number>,
    uEmitSpeed: { value: config.emitSpeed } as UniformSlot<number>,
    uEmitDist: { value: config.emitDist } as UniformSlot<number>,
    uEmitFall: { value: config.emitFall } as UniformSlot<number>,
    uEmitSize: { value: config.emitSize } as UniformSlot<number>,
    uEmitStretch: { value: config.emitStretch } as UniformSlot<number>,
    uEmitAlpha: { value: config.emitAlpha } as UniformSlot<number>,
    uViewportY: { value: h } as UniformSlot<number>,
    uPaleColor: { value: new Color(config.emitPaleColor) } as UniformSlot<Color>,
    uSalmonColor: { value: new Color(config.emitSalmonColor) } as UniformSlot<Color>,
    uOrangeColor: { value: new Color(config.emitOrangeColor) } as UniformSlot<Color>,
    uAmberColor: { value: new Color(config.emitAmberColor) } as UniformSlot<Color>,
    uDeepColor: { value: new Color(config.emitDeepColor) } as UniformSlot<Color>,
  };

  const emitMaterial = new ShaderMaterial({
    glslVersion: GLSL3,
    uniforms: emitUniforms,
    vertexShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_EMITTER_VERTEX}`,
    fragmentShader: `${CONNECT_SHADER_NOISE_UTILS}\n${CONNECT_EMITTER_FRAGMENT}`,
    transparent: true,
    depthWrite: false,
  });

  let meshGeometry = buildConnectGeometry(connectShapeParams(config));
  let emitGeometry = buildEmitterGeometry(config);

  const baseMesh = new Mesh(meshGeometry, baseMaterial);
  baseMesh.renderOrder = 0;
  const hatchMesh = new Mesh(meshGeometry, hatchMaterial);
  hatchMesh.renderOrder = 1;
  const points = new Points(emitGeometry, emitMaterial);
  points.frustumCulled = false;
  points.renderOrder = 2;

  scene.add(baseMesh);
  scene.add(hatchMesh);
  scene.add(points);

  let lastTimeSec = 0;
  let animTime = 0;
  let disposed = false;

  const rebuildShape = (shapeType: ConnectShapeType = config.shapeType) => {
    config.shapeType = shapeType;
    const nextMesh = buildConnectGeometry(connectShapeParams(config));
    const nextEmit = buildEmitterGeometry(config);
    meshGeometry.dispose();
    emitGeometry.dispose();
    meshGeometry = nextMesh;
    emitGeometry = nextEmit;
    baseMesh.geometry = meshGeometry;
    hatchMesh.geometry = meshGeometry;
    points.geometry = emitGeometry;
  };

  const applyParamsToUniforms = () => {
    shared.uWavesX.value = config.wavesX;
    shared.uWavesY.value = config.wavesY;
    shared.uSpeedX.value = config.speedX;
    shared.uSpeedY.value = config.speedY;
    shared.uDisplacementHeight.value = config.displacementHeight;
    shared.uPlaneW.value = config.shapeWidth;
    shared.uPlaneH.value = config.cylinderLength;
    shared.uFillColor.value.set(config.fillColor);
    shared.uFillColor2.value.set(config.fillColor2);
    shared.uFillGradScale.value = config.fillGradScale;
    shared.uFillAlpha.value = config.fillAlpha;
    shared.uFillLow.value = config.fillLow;
    shared.uFillHigh.value = config.fillHigh;
    shared.uFillRadius.value = config.fillRadius;
    shared.uLineColor.value.set(config.lineColor);
    shared.uLineCount.value = config.lineCount;
    shared.uLineWidth.value = config.lineWidth;
    shared.uLineAlpha.value = config.lineAlpha;
    shared.uLineFadeLow.value = config.lineFadeLow;
    shared.uLineFadeHigh.value = config.lineFadeHigh;
    shared.uHatchAngle.value = config.hatchAngle;
    shared.uHatchSpacing.value = config.hatchSpacing;
    shared.uHatchCell.value = config.hatchCell;
    shared.uHatchFill.value = config.hatchFill;
    shared.uDashMin.value = config.dashMin;
    shared.uDashMax.value = config.dashMax;
    shared.uHatchDensity.value = config.hatchDensity;
    shared.uDensityFloor.value = config.densityFloor;
    shared.uHatchDrift.value = config.hatchDrift;
    shared.uWaveGate.value = config.waveGate;
    shared.uEnvCenter.value = config.envCenter;
    shared.uEnvSlope.value = config.envSlope;
    shared.uEnvWidth.value = config.envWidth;
    shared.uPaleColor.value.set(config.paleColor);
    shared.uSalmonColor.value.set(config.salmonColor);
    shared.uOrangeColor.value.set(config.orangeColor);
    shared.uAmberColor.value.set(config.amberColor);
    shared.uDeepColor.value.set(config.deepColor);
    hatchLiftSlot.value = config.hatchLift;

    emitUniforms.uWavesX.value = config.wavesX;
    emitUniforms.uWavesY.value = config.wavesY;
    emitUniforms.uSpeedX.value = config.speedX;
    emitUniforms.uSpeedY.value = config.speedY;
    emitUniforms.uDisplacementHeight.value = config.displacementHeight;
    emitUniforms.uEmitAmount.value = config.emitAmount;
    emitUniforms.uEmitSpeed.value = config.emitSpeed;
    emitUniforms.uEmitDist.value = config.emitDist;
    emitUniforms.uEmitFall.value = config.emitFall;
    emitUniforms.uEmitSize.value = config.emitSize;
    emitUniforms.uEmitStretch.value = config.emitStretch;
    emitUniforms.uEmitAlpha.value = config.emitAlpha;
    emitUniforms.uPaleColor.value.set(config.emitPaleColor);
    emitUniforms.uSalmonColor.value.set(config.emitSalmonColor);
    emitUniforms.uOrangeColor.value.set(config.emitOrangeColor);
    emitUniforms.uAmberColor.value.set(config.emitAmberColor);
    emitUniforms.uDeepColor.value.set(config.emitDeepColor);
  };

  const getParamsSnapshot = (): ConnectShaderParams =>
    normalizeConnectShaderParams({
      speed: config.speed,
      shapeWidth: config.shapeWidth,
      twistX: config.twistX,
      twistY: config.twistY,
      shapeRadius: config.shapeRadius,
      shapeConeRadiusStart: config.shapeConeRadiusStart,
      shapeConeRadiusEnd: config.shapeConeRadiusEnd,
      shapeTube: config.shapeTube,
      shapeBend: config.shapeBend,
      shapePitch: config.shapePitch,
      shapeAmplitude: config.shapeAmplitude,
      shapeTurns: config.shapeTurns,
      shapeWaveFreq: config.shapeWaveFreq,
      cylinderLength: config.cylinderLength,
      wavesX: config.wavesX,
      wavesY: config.wavesY,
      displacementHeight: config.displacementHeight,
      speedX: config.speedX,
      speedY: config.speedY,
      fillColor: config.fillColor,
      fillColor2: config.fillColor2,
      fillGradScale: config.fillGradScale,
      fillAlpha: config.fillAlpha,
      fillLow: config.fillLow,
      fillHigh: config.fillHigh,
      fillRadius: config.fillRadius,
      lineColor: config.lineColor,
      lineCount: config.lineCount,
      lineWidth: config.lineWidth,
      lineAlpha: config.lineAlpha,
      lineFadeLow: config.lineFadeLow,
      lineFadeHigh: config.lineFadeHigh,
      hatchAngle: config.hatchAngle,
      hatchLift: config.hatchLift,
      hatchSpacing: config.hatchSpacing,
      hatchCell: config.hatchCell,
      hatchFill: config.hatchFill,
      dashMin: config.dashMin,
      dashMax: config.dashMax,
      hatchDensity: config.hatchDensity,
      densityFloor: config.densityFloor,
      hatchDrift: config.hatchDrift,
      waveGate: config.waveGate,
      envCenter: config.envCenter,
      envSlope: config.envSlope,
      envWidth: config.envWidth,
      emitCount: config.emitCount,
      emitAmount: config.emitAmount,
      emitSpeed: config.emitSpeed,
      emitDist: config.emitDist,
      emitFall: config.emitFall,
      emitSize: config.emitSize,
      emitStretch: config.emitStretch,
      emitAlpha: config.emitAlpha,
      emitPaleColor: config.emitPaleColor,
      emitSalmonColor: config.emitSalmonColor,
      emitOrangeColor: config.emitOrangeColor,
      emitAmberColor: config.emitAmberColor,
      emitDeepColor: config.emitDeepColor,
      paleColor: config.paleColor,
      salmonColor: config.salmonColor,
      orangeColor: config.orangeColor,
      amberColor: config.amberColor,
      deepColor: config.deepColor,
      renderDpr: config.renderDpr,
      shapeMeshQuality: config.shapeMeshQuality,
      renderAntialias: config.renderAntialias,
    });

  return {
    canvas,
    underlayCanvas,
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
    setShape(shapeType) {
      if (disposed || shapeType === config.shapeType) return;
      rebuildShape(shapeType);
    },
    setParams(nextParams) {
      if (disposed) return getParamsSnapshot();
      const merged = normalizeConnectShaderParams({ ...getParamsSnapshot(), ...nextParams });
      let needsRebuild = false;
      for (const key of CONNECT_GEOMETRY_PARAM_KEYS) {
        if (merged[key] !== config[key]) {
          needsRebuild = true;
          break;
        }
      }
      Object.assign(config, merged);
      applyParamsToUniforms();
      if (needsRebuild) rebuildShape();
      return getParamsSnapshot();
    },
    getParams() {
      return getParamsSnapshot();
    },
    setCamera(state) {
      if (disposed) return cameraState;
      return applyCameraState({ ...cameraState, ...state });
    },
    getCamera() {
      return { ...cameraState };
    },
    orbit(deltaRotateYDeg, deltaRotateXDeg) {
      if (disposed) return cameraState;
      return applyCameraState({
        ...cameraState,
        rotateYDeg: cameraState.rotateYDeg + deltaRotateYDeg,
        rotateXDeg: cameraState.rotateXDeg + deltaRotateXDeg,
      });
    },
    zoom(factor) {
      if (disposed) return cameraState;
      const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
      return applyCameraState({
        ...cameraState,
        distance: cameraState.distance * safeFactor,
      });
    },
    resetCamera() {
      if (disposed) return cameraState;
      return applyCameraState(CONNECT_CAMERA_DEFAULTS);
    },
    resize(nextWidth, nextHeight) {
      if (disposed) return;
      const nextW = Math.max(1, Math.round(nextWidth));
      const nextH = Math.max(1, Math.round(nextHeight));
      if (canvas.width === nextW && canvas.height === nextH) return;
      canvas.width = nextW;
      canvas.height = nextH;
      underlayCanvas.width = nextW;
      underlayCanvas.height = nextH;
      renderer.setSize(nextW, nextH, false);
      camera.aspect = nextW / Math.max(1, nextH);
      camera.updateProjectionMatrix();
      emitUniforms.uViewportY.value = nextH;
    },
    render(timeSec) {
      if (disposed) return;
      const delta = Math.max(0, Math.min(0.1, timeSec - lastTimeSec));
      lastTimeSec = timeSec;
      animTime += delta * config.speed;
      shared.uTime.value = animTime;
      emitUniforms.uTime.value = animTime;
      emitUniforms.uViewportY.value = canvas.height;

      // Fill-only underlay: same camera/time/colors, no hatch/particles/mesh lines.
      const savedLineAlpha = shared.uLineAlpha.value;
      hatchMesh.visible = false;
      points.visible = false;
      shared.uLineAlpha.value = 0;
      renderer.render(scene, camera);
      if (underlayCtx) {
        underlayCtx.clearRect(0, 0, underlayCanvas.width, underlayCanvas.height);
        underlayCtx.drawImage(canvas, 0, 0);
      }
      shared.uLineAlpha.value = savedLineAlpha;
      hatchMesh.visible = true;
      points.visible = true;

      // Full Connect pass for the stripes-engine texture source.
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      meshGeometry.dispose();
      emitGeometry.dispose();
      baseMaterial.dispose();
      hatchMaterial.dispose();
      emitMaterial.dispose();
      renderer.dispose();
    },
  };
}
