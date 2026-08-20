import {
  ACESFilmicToneMapping,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";

export const BADGE_DPR_MAX = 1.5;
export const BADGE_ENV_INTENSITY = 0.85;
export const BADGE_TONE_EXPOSURE = 1.05;
export const BADGE_ANISOTROPY = 8;
export const BADGE_PRINT_ROUGHNESS = 0.08;
export const BADGE_PRINT_CLEARCOAT = 1;
export const BADGE_PRINT_CLEARCOAT_ROUGHNESS = 0.04;
export const BADGE_PRINT_ENV = 1.8;

export const BADGE_ACCENT_LIGHTS = [
  { position: [4.2, 5.2, 6.2] as const, scale: 0.95 },
  { position: [-4.8, -2.2, 4.8] as const, scale: 0.6 },
] as const;

type StudioPanel = {
  color: string;
  width: number;
  height: number;
  position: readonly [number, number, number];
};

const STUDIO_PANELS: readonly StudioPanel[] = [
  { color: "#ffffff", width: 10, height: 8, position: [4.6, 5.4, 7.2] },
  { color: "#dce7f4", width: 8, height: 8, position: [-6.2, 2.2, 5.2] },
  { color: "#fff4e0", width: 12, height: 4, position: [0, 8.2, 2.4] },
  { color: "#2a2a2e", width: 16, height: 16, position: [0, -6.4, 0.2] },
];

export function badgeAnisotropy(
  gl: WebGLRenderer,
  lowPower: boolean
): number {
  if (lowPower) return 1;
  return Math.min(BADGE_ANISOTROPY, gl.capabilities.getMaxAnisotropy());
}

function addStudioPanel(studio: Scene, panel: StudioPanel) {
  const mesh = new Mesh(
    new PlaneGeometry(panel.width, panel.height),
    new MeshBasicMaterial({ color: panel.color })
  );
  mesh.position.set(...panel.position);
  mesh.lookAt(0, 0, 0);
  studio.add(mesh);
}

function disposeStudio(studio: Scene) {
  studio.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const material = child.material;
    if (Array.isArray(material)) {
      for (const entry of material) entry.dispose();
      return;
    }
    material.dispose();
  });
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
  const studio = new Scene();
  for (const panel of STUDIO_PANELS) addStudioPanel(studio, panel);
  const pmrem = new PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(studio, 0.03).texture;
  scene.environmentIntensity = BADGE_ENV_INTENSITY;
  disposeStudio(studio);
  pmrem.dispose();
}
