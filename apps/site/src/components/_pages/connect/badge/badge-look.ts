import {
  ACESFilmicToneMapping,
  NoToneMapping,
  PMREMGenerator,
  SRGBColorSpace,
  type Scene,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const BADGE_DPR_MAX = 2;
export const BADGE_ENV_INTENSITY = 0.55;
export const BADGE_TONE_EXPOSURE = 1.05;
export const BADGE_ANISOTROPY = 8;
export const BADGE_PRINT_ROUGHNESS = 0.1;
export const BADGE_PRINT_CLEARCOAT = 1;
export const BADGE_PRINT_CLEARCOAT_ROUGHNESS = 0.05;
export const BADGE_PRINT_ENV = 1.15;

export const BADGE_ACCENT_LIGHTS = [
  { position: [4.2, 5.2, 6.2] as const, scale: 0.95 },
  { position: [-4.8, -2.2, 4.8] as const, scale: 0.6 },
] as const;

export function badgeAnisotropy(
  gl: WebGLRenderer,
  lowPower: boolean
): number {
  if (lowPower) return 1;
  return Math.min(BADGE_ANISOTROPY, gl.capabilities.getMaxAnisotropy());
}

export function applyBadgeLook(
  gl: WebGLRenderer,
  scene: Scene,
  lowPower: boolean
) {
  gl.outputColorSpace = SRGBColorSpace;
  if (lowPower) {
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = 1;
    scene.environment = null;
    scene.environmentIntensity = 1;
    return;
  }

  gl.toneMapping = ACESFilmicToneMapping;
  gl.toneMappingExposure = BADGE_TONE_EXPOSURE;
  const pmrem = new PMREMGenerator(gl);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = BADGE_ENV_INTENSITY;
  room.dispose();
  pmrem.dispose();
}
