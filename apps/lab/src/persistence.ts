import { migrateLegacyConfig, sanitizeThemedConfig } from "@necatikcl/stripes-engine";
import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { DEFAULT_LAB_ENGINE_CONFIG, DEFAULT_LAB_UI_SETTINGS } from "./defaultLabConfig";
import { DEFAULT_SHADER_TEXTURE_SOURCE } from "./shaderTextureSource";
import type { ConnectShapeType } from "./connectShader";
import {
  CONNECT_CAMERA_DEFAULTS,
  CONNECT_SHAPE_OPTIONS,
  normalizeConnectCameraState,
  normalizeConnectShaderParams,
} from "./connectShader";
import type { ConnectShaderParams } from "./connectShader";
import { normalizeShaderViewState } from "./shaderView";
import { clampPreviewZoom } from "./canvasFitPreviewZoom";
import { normalizeTwizzlerSettings, type TwizzlerSettings } from "./twizzler";
import { normalizeTwizzlerMapSettings, type TwizzlerMapSettings } from "./twizzlerMapSource";
import { COMET_LOGO_DEFAULTS, normalizeCometLogoSettings, type CometLogoSettings } from "@necatikcl/stripes-engine";
import { clearCustomStripePalettes } from "./controls/customStripePalettes";

const MAP_KEY = "stripes-engine-lab-by-texture";
const LAST_KEY = "stripes-engine-lab-last-config";
const LAST_BACKGROUND_COLOR_KEY = "stripes-engine-lab-last-background-color";
const LAB_SETTINGS_KEY = "stripes-engine-lab-ui-settings";
const LAB_SETTINGS_GENERATION_KEY = "stripes-engine-lab-ui-generation";
/** Bump when factory boot experience intentionally changes (invalidates stale localStorage). */
export const LAB_SETTINGS_GENERATION = "twizzler-ribbon-visible-v1";
const TEXTURE_KEY = "stripes-engine-lab-texture";
const CONFIG_FILE_KIND = "stripes-engine-lab-settings";
const CONFIG_FILE_VERSION = 2;
const WINDOW_NAME_STATE_KEY = "__stripesEngineLab";
const BACKGROUND_QUERY_PARAM = "bg";
const PENDING_CONFIG_KEY = "stripes-engine-lab-pending-config";
const EDIT_THEME_KEY = "stripes-engine-lab-theme";

let persistenceWritesEnabled = true;

export function resumePersistenceWritesForTests(): void {
  persistenceWritesEnabled = true;
}

export type LabCanvasMode = "scale" | "manual" | "original";
export type LabBackgroundFillMode = "transparent" | "source" | "solid" | "gradient";
export type LabTextureSourceMode = "texture" | "shader";
export type LabBackgroundRampSettings = {
  brightnessAdd: number;
  hueDriftDeg: number;
  saturationBoost: number;
  maxLightnessUnder20: number;
  maxLightness20To40: number;
  maxLightness40To60: number;
  maxLightness60To70: number;
  maxLightness70To80: number;
  maxLightnessOver80: number;
};

export type LabSettings = {
  canvasMode: LabCanvasMode;
  canvasScale: number;
  canvasWidth: number;
  canvasHeight: number;
  canvasAspectLocked: boolean;
  exportStartSec: number;
  exportDurationSec: number;
  exportSvgIncludeBackground: boolean;
  backgroundColor: number | null;
  textureId: string | null;
  textureSourceMode: LabTextureSourceMode;
  shaderSourceCode: string;
  shaderSourceWidth: number;
  shaderSourceHeight: number;
  twizzlerEnabled: boolean;
  twizzler: TwizzlerSettings;
  twizzlerMap: TwizzlerMapSettings;
  cometLogo: CometLogoSettings;
  backgroundFillMode: LabBackgroundFillMode | null;
  backgroundSourceOpacity: number;
  stripePalette: string | null;
  backgroundRampEasing: string | null;
  backgroundRampSettings: LabBackgroundRampSettings;
  thresholdDistributionEasing: string | null;
  autoStripeWidths: boolean | null;
  drawerOpen: Record<string, boolean>;
  previewZoom: number | null;
  textureSidebarOpen: boolean;
  shaderSidebarOpen: boolean;
  textureSidebarWidth: number;
  shaderSidebarWidth: number;
  connectShapeType: ConnectShapeType;
  shaderPresetId: string;
  connectCameraDistance: number;
  connectCameraRotateX: number;
  connectCameraRotateY: number;
  connectCameraRotateZ: number;
  connectCameraPanX: number;
  connectCameraPanY: number;
  connectCameraFov: number;
  connectGradientUnderlay: boolean;
  connectShaderParams: ConnectShaderParams;
  shaderViewDistance: number;
  shaderViewRotateX: number;
  shaderViewRotateY: number;
  shaderViewRotateZ: number;
  shaderViewPanX: number;
  shaderViewPanY: number;
  shaderViewFov: number;
};

export const DEFAULT_LAB_SETTINGS: LabSettings = {
  ...DEFAULT_LAB_UI_SETTINGS,
  cometLogo: { ...COMET_LOGO_DEFAULTS },
};

type ConfigFile = {
  kind: typeof CONFIG_FILE_KIND;
  version: number;
  config: ThemedEngineConfig;
  lab?: Partial<LabSettings>;
};

function isConfigFile(value: unknown): value is ConfigFile {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === CONFIG_FILE_KIND && typeof record.config === "object" && record.config !== null;
}

function loadConfigMap(): Record<string, ThemedEngineConfig> {
  try {
    const raw = localStorage.getItem(MAP_KEY);
    if (raw) return JSON.parse(raw) as Record<string, ThemedEngineConfig>;
  } catch {
    /* ignore corrupt storage */
  }
  return {};
}

function loadLastConfig(): ThemedEngineConfig | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as ThemedEngineConfig) : null;
  } catch {
    return null;
  }
}

function saveLastConfig(c: ThemedEngineConfig): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(c));
  } catch {
    /* ignore quota errors */
  }
}

function normalizeColor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(0xffffff, Math.round(value)));
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

const CONNECT_SHAPE_TYPE_SET = new Set<string>(CONNECT_SHAPE_OPTIONS.map((option) => option.value));

function normalizeConnectShapeType(value: unknown): ConnectShapeType {
  return typeof value === "string" && CONNECT_SHAPE_TYPE_SET.has(value)
    ? (value as ConnectShapeType)
    : DEFAULT_LAB_SETTINGS.connectShapeType;
}

function normalizeShaderPresetId(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : DEFAULT_LAB_SETTINGS.shaderPresetId;
}

function normalizeConnectCameraFromSettings(i: Partial<LabSettings> & Record<string, unknown>): {
  connectCameraDistance: number;
  connectCameraRotateX: number;
  connectCameraRotateY: number;
  connectCameraRotateZ: number;
  connectCameraPanX: number;
  connectCameraPanY: number;
  connectCameraFov: number;
} {
  const legacyY = typeof i.connectCameraY === "number" && Number.isFinite(i.connectCameraY) ? i.connectCameraY : null;
  const legacyZ = typeof i.connectCameraZ === "number" && Number.isFinite(i.connectCameraZ) ? i.connectCameraZ : null;
  const legacyAzimuth =
    typeof i.connectCameraAzimuthDeg === "number" && Number.isFinite(i.connectCameraAzimuthDeg)
      ? i.connectCameraAzimuthDeg
      : null;

  let distance =
    typeof i.connectCameraDistance === "number" && Number.isFinite(i.connectCameraDistance)
      ? i.connectCameraDistance
      : null;
  let rotateX =
    typeof i.connectCameraRotateX === "number" && Number.isFinite(i.connectCameraRotateX)
      ? i.connectCameraRotateX
      : null;
  let rotateY =
    typeof i.connectCameraRotateY === "number" && Number.isFinite(i.connectCameraRotateY)
      ? i.connectCameraRotateY
      : legacyAzimuth;
  const rotateZ =
    typeof i.connectCameraRotateZ === "number" && Number.isFinite(i.connectCameraRotateZ)
      ? i.connectCameraRotateZ
      : CONNECT_CAMERA_DEFAULTS.rotateZDeg;

  if (distance === null && legacyZ !== null) {
    distance = legacyY !== null ? Math.hypot(legacyY, legacyZ) : legacyZ;
  }
  if (rotateX === null && legacyY !== null && legacyZ !== null) {
    rotateX = (Math.atan2(legacyY, legacyZ) * 180) / Math.PI;
  }

  const camera = normalizeConnectCameraState({
    distance: distance ?? CONNECT_CAMERA_DEFAULTS.distance,
    rotateXDeg: rotateX ?? CONNECT_CAMERA_DEFAULTS.rotateXDeg,
    rotateYDeg: rotateY ?? CONNECT_CAMERA_DEFAULTS.rotateYDeg,
    rotateZDeg: rotateZ,
    panX: typeof i.connectCameraPanX === "number" ? i.connectCameraPanX : CONNECT_CAMERA_DEFAULTS.panX,
    panY: typeof i.connectCameraPanY === "number" ? i.connectCameraPanY : CONNECT_CAMERA_DEFAULTS.panY,
    fov: typeof i.connectCameraFov === "number" ? i.connectCameraFov : CONNECT_CAMERA_DEFAULTS.fov,
  });
  return {
    connectCameraDistance: camera.distance,
    connectCameraRotateX: camera.rotateXDeg,
    connectCameraRotateY: camera.rotateYDeg,
    connectCameraRotateZ: camera.rotateZDeg,
    connectCameraPanX: camera.panX,
    connectCameraPanY: camera.panY,
    connectCameraFov: camera.fov,
  };
}

function normalizeBackgroundRampSettings(value: unknown): LabBackgroundRampSettings {
  const fallback = DEFAULT_LAB_SETTINGS.backgroundRampSettings;
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const n = (key: keyof LabBackgroundRampSettings, min: number, max: number): number => {
    const raw = record[key];
    return typeof raw === "number" && Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : fallback[key];
  };
  return {
    brightnessAdd: n("brightnessAdd", 0, 100),
    hueDriftDeg: n("hueDriftDeg", -180, 180),
    saturationBoost: n("saturationBoost", 0, 100),
    maxLightnessUnder20: n("maxLightnessUnder20", 0, 100),
    maxLightness20To40: n("maxLightness20To40", 0, 100),
    maxLightness40To60: n("maxLightness40To60", 0, 100),
    maxLightness60To70: n("maxLightness60To70", 0, 100),
    maxLightness70To80: n("maxLightness70To80", 0, 100),
    maxLightnessOver80: n("maxLightnessOver80", 0, 100),
  };
}

function normalizeBackgroundFillMode(value: unknown): LabBackgroundFillMode | null {
  return value === "transparent" || value === "source" || value === "solid" || value === "gradient" ? value : null;
}

function normalizeDrawerOpen(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [key, open] of Object.entries(value as Record<string, unknown>)) {
    if (typeof open === "boolean") out[key] = open;
  }
  return out;
}

function clearUrlBackgroundColor(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(BACKGROUND_QUERY_PARAM)) return;
    url.searchParams.delete(BACKGROUND_QUERY_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === current) return;
    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* ignore */
  }
}

function deleteCookie(key: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax`;
}

function clearWindowNameState(): void {
  if (typeof window === "undefined" || typeof window.name !== "string") return;
  try {
    const root = window.name ? (JSON.parse(window.name) as Record<string, unknown>) : {};
    if (root && typeof root === "object" && WINDOW_NAME_STATE_KEY in root) {
      delete root[WINDOW_NAME_STATE_KEY];
      window.name = Object.keys(root).length > 0 ? JSON.stringify(root) : "";
    }
  } catch {
    window.name = "";
  }
}

function readPendingConfig(): ThemedEngineConfig | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CONFIG_KEY);
    sessionStorage.removeItem(PENDING_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as ThemedEngineConfig) : null;
  } catch {
    return null;
  }
}

export function stagePendingConfig(config: ThemedEngineConfig): void {
  if (!persistenceWritesEnabled) return;
  try {
    sessionStorage.setItem(PENDING_CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* ignore quota errors */
  }
}

export function loadInitialConfig(textureId: string): ThemedEngineConfig {
  const pending = readPendingConfig();
  if (pending) return pending;
  try {
    const map = loadConfigMap();
    if (textureId in map) return map[textureId] ?? DEFAULT_LAB_ENGINE_CONFIG;
    const last = loadLastConfig();
    if (last) return last;
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_LAB_ENGINE_CONFIG;
}

export function saveConfig(textureId: string, c: ThemedEngineConfig): void {
  if (!persistenceWritesEnabled) return;
  try {
    const map = loadConfigMap();
    map[textureId] = c;
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
    saveLastConfig(c);
  } catch {
    /* ignore quota errors */
  }
}

export function deleteConfig(textureId: string): void {
  if (!persistenceWritesEnabled) return;
  try {
    const map = loadConfigMap();
    if (textureId in map) {
      delete map[textureId];
      localStorage.setItem(MAP_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }
}

export function loadStickyBackgroundColor(): number | null {
  return null;
}

export function saveStickyBackgroundColor(_color: number): void {}

export function clearStickyBackgroundColor(): void {}

export function loadTextureId(): string | null {
  try {
    return localStorage.getItem(TEXTURE_KEY);
  } catch {
    return null;
  }
}

export function saveTextureId(id: string): void {
  try {
    localStorage.setItem(TEXTURE_KEY, id);
  } catch {
    /* ignore quota errors */
  }
}

export type LabEditTheme = "light" | "dark";

export function loadEditTheme(): LabEditTheme {
  try {
    return localStorage.getItem(EDIT_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveEditTheme(theme: LabEditTheme): void {
  if (!persistenceWritesEnabled) return;
  try {
    localStorage.setItem(EDIT_THEME_KEY, theme);
  } catch {
    /* ignore quota errors */
  }
}

export function normalizeLabSettings(i: Partial<LabSettings> = {}): LabSettings {
  const canvasMode = i.canvasMode === "manual" ? "manual" : i.canvasMode === "original" ? "original" : "scale";
  const n = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const has = (key: keyof LabSettings): boolean => Object.prototype.hasOwnProperty.call(i, key);
  const textureSourceMode = has("textureSourceMode")
    ? i.textureSourceMode === "shader"
      ? "shader"
      : "texture"
    : DEFAULT_LAB_SETTINGS.textureSourceMode;
  const hasBackgroundColor = Object.prototype.hasOwnProperty.call(i, "backgroundColor");
  const backgroundColor = hasBackgroundColor ? normalizeColor(i.backgroundColor) : DEFAULT_LAB_SETTINGS.backgroundColor;
  const rawShaderSource = has("shaderSourceCode") && typeof i.shaderSourceCode === "string" ? i.shaderSourceCode : "";
  const shaderSourceCode =
    rawShaderSource && !rawShaderSource.includes("float rings = 0.5 + 0.5 * cos(18.0 * r")
      ? rawShaderSource
      : DEFAULT_LAB_SETTINGS.shaderSourceCode || DEFAULT_SHADER_TEXTURE_SOURCE;
  return {
    canvasMode,
    canvasScale: Math.max(0.1, Math.min(8, n(i.canvasScale, DEFAULT_LAB_SETTINGS.canvasScale))),
    canvasWidth: Math.round(Math.max(1, Math.min(8192, n(i.canvasWidth, DEFAULT_LAB_SETTINGS.canvasWidth)))),
    canvasHeight: Math.round(Math.max(1, Math.min(8192, n(i.canvasHeight, DEFAULT_LAB_SETTINGS.canvasHeight)))),
    canvasAspectLocked:
      typeof i.canvasAspectLocked === "boolean" ? i.canvasAspectLocked : DEFAULT_LAB_SETTINGS.canvasAspectLocked,
    exportStartSec: Math.max(0, Math.min(24 * 60 * 60, n(i.exportStartSec, DEFAULT_LAB_SETTINGS.exportStartSec))),
    exportDurationSec: Math.max(
      0.1,
      Math.min(24 * 60 * 60, n(i.exportDurationSec, DEFAULT_LAB_SETTINGS.exportDurationSec)),
    ),
    exportSvgIncludeBackground:
      typeof i.exportSvgIncludeBackground === "boolean"
        ? i.exportSvgIncludeBackground
        : DEFAULT_LAB_SETTINGS.exportSvgIncludeBackground,
    backgroundColor,
    textureId: has("textureId") ? normalizeString(i.textureId) : DEFAULT_LAB_SETTINGS.textureId,
    textureSourceMode,
    shaderSourceCode,
    shaderSourceWidth: Math.round(
      Math.max(1, Math.min(8192, n(i.shaderSourceWidth, DEFAULT_LAB_SETTINGS.shaderSourceWidth))),
    ),
    shaderSourceHeight: Math.round(
      Math.max(1, Math.min(8192, n(i.shaderSourceHeight, DEFAULT_LAB_SETTINGS.shaderSourceHeight))),
    ),
    twizzlerEnabled: typeof i.twizzlerEnabled === "boolean" ? i.twizzlerEnabled : DEFAULT_LAB_SETTINGS.twizzlerEnabled,
    twizzler: normalizeTwizzlerSettings(i.twizzler ?? DEFAULT_LAB_SETTINGS.twizzler),
    twizzlerMap: normalizeTwizzlerMapSettings(i.twizzlerMap ?? DEFAULT_LAB_SETTINGS.twizzlerMap),
    cometLogo: normalizeCometLogoSettings(i.cometLogo ?? DEFAULT_LAB_SETTINGS.cometLogo),
    backgroundFillMode: has("backgroundFillMode")
      ? normalizeBackgroundFillMode(i.backgroundFillMode)
      : DEFAULT_LAB_SETTINGS.backgroundFillMode,
    backgroundSourceOpacity: Math.max(
      0,
      Math.min(1, n(i.backgroundSourceOpacity, DEFAULT_LAB_SETTINGS.backgroundSourceOpacity)),
    ),
    stripePalette: has("stripePalette") ? normalizeString(i.stripePalette) : DEFAULT_LAB_SETTINGS.stripePalette,
    backgroundRampEasing: has("backgroundRampEasing")
      ? normalizeString(i.backgroundRampEasing)
      : DEFAULT_LAB_SETTINGS.backgroundRampEasing,
    backgroundRampSettings: has("backgroundRampSettings")
      ? normalizeBackgroundRampSettings(i.backgroundRampSettings)
      : DEFAULT_LAB_SETTINGS.backgroundRampSettings,
    thresholdDistributionEasing: has("thresholdDistributionEasing")
      ? normalizeString(i.thresholdDistributionEasing)
      : DEFAULT_LAB_SETTINGS.thresholdDistributionEasing,
    autoStripeWidths: has("autoStripeWidths")
      ? normalizeBoolean(i.autoStripeWidths)
      : DEFAULT_LAB_SETTINGS.autoStripeWidths,
    drawerOpen: has("drawerOpen") ? normalizeDrawerOpen(i.drawerOpen) : DEFAULT_LAB_SETTINGS.drawerOpen,
    previewZoom:
      typeof i.previewZoom === "number" && Number.isFinite(i.previewZoom) && i.previewZoom > 0
        ? clampPreviewZoom(i.previewZoom)
        : has("previewZoom")
          ? null
          : DEFAULT_LAB_SETTINGS.previewZoom,
    textureSidebarOpen:
      typeof i.textureSidebarOpen === "boolean" ? i.textureSidebarOpen : DEFAULT_LAB_SETTINGS.textureSidebarOpen,
    shaderSidebarOpen:
      typeof i.shaderSidebarOpen === "boolean" ? i.shaderSidebarOpen : DEFAULT_LAB_SETTINGS.shaderSidebarOpen,
    textureSidebarWidth: Math.round(
      Math.max(240, Math.min(640, n(i.textureSidebarWidth, DEFAULT_LAB_SETTINGS.textureSidebarWidth))),
    ),
    shaderSidebarWidth: Math.round(
      Math.max(240, Math.min(640, n(i.shaderSidebarWidth, DEFAULT_LAB_SETTINGS.shaderSidebarWidth))),
    ),
    connectShapeType: normalizeConnectShapeType(i.connectShapeType),
    shaderPresetId: normalizeShaderPresetId(i.shaderPresetId),
    ...normalizeConnectCameraFromSettings(i),
    connectGradientUnderlay:
      typeof i.connectGradientUnderlay === "boolean"
        ? i.connectGradientUnderlay
        : DEFAULT_LAB_SETTINGS.connectGradientUnderlay,
    connectShaderParams: normalizeConnectShaderParams(i.connectShaderParams),
    ...(() => {
      const view = normalizeShaderViewState({
        distance: typeof i.shaderViewDistance === "number" ? i.shaderViewDistance : undefined,
        rotateXDeg: typeof i.shaderViewRotateX === "number" ? i.shaderViewRotateX : undefined,
        rotateYDeg: typeof i.shaderViewRotateY === "number" ? i.shaderViewRotateY : undefined,
        rotateZDeg: typeof i.shaderViewRotateZ === "number" ? i.shaderViewRotateZ : undefined,
        panX: typeof i.shaderViewPanX === "number" ? i.shaderViewPanX : undefined,
        panY: typeof i.shaderViewPanY === "number" ? i.shaderViewPanY : undefined,
        fov: typeof i.shaderViewFov === "number" ? i.shaderViewFov : undefined,
      });
      return {
        shaderViewDistance: view.distance,
        shaderViewRotateX: view.rotateXDeg,
        shaderViewRotateY: view.rotateYDeg,
        shaderViewRotateZ: view.rotateZDeg,
        shaderViewPanX: view.panX,
        shaderViewPanY: view.panY,
        shaderViewFov: view.fov,
      };
    })(),
  };
}

function writeFactoryLabSettings(): LabSettings {
  const next = {
    ...normalizeLabSettings(DEFAULT_LAB_SETTINGS),
    cometLogo: { ...COMET_LOGO_DEFAULTS },
  };
  localStorage.setItem(LAB_SETTINGS_GENERATION_KEY, LAB_SETTINGS_GENERATION);
  localStorage.setItem(LAB_SETTINGS_KEY, JSON.stringify(withoutSessionOnlyLabSettings(next)));
  return next;
}

function clearStaleEngineConfigCache(): void {
  localStorage.removeItem(MAP_KEY);
  localStorage.removeItem(LAST_KEY);
  localStorage.removeItem(LAST_BACKGROUND_COLOR_KEY);
  localStorage.removeItem(TEXTURE_KEY);
}

export function loadLabSettings(): LabSettings {
  try {
    const generation = localStorage.getItem(LAB_SETTINGS_GENERATION_KEY);
    if (generation !== LAB_SETTINGS_GENERATION) {
      clearStaleEngineConfigCache();
      return writeFactoryLabSettings();
    }
    const raw = localStorage.getItem(LAB_SETTINGS_KEY);
    return {
      ...normalizeLabSettings(raw ? (JSON.parse(raw) as Partial<LabSettings>) : {}),
      cometLogo: { ...COMET_LOGO_DEFAULTS },
    };
  } catch {
    return DEFAULT_LAB_SETTINGS;
  }
}

/** One-shot URL reset: `?factory=1` clears saved lab state to current factory defaults. */
export function consumeFactoryBootReset(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("factory") !== "1") return;
    factoryResetSettings();
    persistenceWritesEnabled = true;
    writeFactoryLabSettings();
    url.searchParams.delete("factory");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

function withoutSessionOnlyLabSettings(settings: LabSettings): Omit<LabSettings, "cometLogo"> {
  const { cometLogo: _cometLogo, ...persisted } = settings;
  return persisted;
}

export function saveLabSettings(settings: Partial<LabSettings>): void {
  if (!persistenceWritesEnabled) return;
  try {
    const next = normalizeLabSettings({ ...loadLabSettings(), ...settings });
    localStorage.setItem(LAB_SETTINGS_GENERATION_KEY, LAB_SETTINGS_GENERATION);
    localStorage.setItem(LAB_SETTINGS_KEY, JSON.stringify(withoutSessionOnlyLabSettings(next)));
  } catch {
    /* ignore quota errors */
  }
}

export function factoryResetSettings(): void {
  try {
    localStorage.removeItem(MAP_KEY);
    localStorage.removeItem(LAST_KEY);
    localStorage.removeItem(LAST_BACKGROUND_COLOR_KEY);
    localStorage.removeItem(LAB_SETTINGS_KEY);
    localStorage.removeItem(LAB_SETTINGS_GENERATION_KEY);
    localStorage.removeItem(TEXTURE_KEY);
    localStorage.removeItem(EDIT_THEME_KEY);
    clearCustomStripePalettes();
    sessionStorage.removeItem(PENDING_CONFIG_KEY);
    clearUrlBackgroundColor();
    deleteCookie(LAST_BACKGROUND_COLOR_KEY);
    clearWindowNameState();
    writeFactoryLabSettings();
  } catch {
    /* ignore */
  } finally {
    persistenceWritesEnabled = false;
  }
}

const IMPORT_PRISTINE_KEY = "stripes-engine-lab-import-pristine";

export function markImportedConfigPristine(): void {
  try {
    sessionStorage.setItem(IMPORT_PRISTINE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeImportedConfigPristine(): boolean {
  try {
    const pristine = sessionStorage.getItem(IMPORT_PRISTINE_KEY) === "1";
    sessionStorage.removeItem(IMPORT_PRISTINE_KEY);
    return pristine;
  } catch {
    return false;
  }
}

export function importConfig(text: string): ThemedEngineConfig {
  return importSettingsFile(text).config;
}

export function importSettingsFile(text: string): { config: ThemedEngineConfig; lab: LabSettings | null } {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const configLike = isConfigFile(parsed) ? (parsed.config as Record<string, unknown>) : parsed;
  const looksLegacy =
    "textureAdjustments" in configLike || "sourceTransform" in configLike || "textureLuminanceMode" in configLike;
  const config = sanitizeThemedConfig(
    looksLegacy ? migrateLegacyConfig(configLike) : (configLike as ThemedEngineConfig),
  );
  return {
    config,
    lab: isConfigFile(parsed) && parsed.lab ? normalizeLabSettings(parsed.lab) : null,
  };
}

export function serializeConfigFile(c: ThemedEngineConfig, lab?: Partial<LabSettings>): string {
  const normalizedLab = lab ? normalizeLabSettings(lab) : null;
  const file: ConfigFile = {
    kind: CONFIG_FILE_KIND,
    version: CONFIG_FILE_VERSION,
    config: c,
    ...(normalizedLab ? { lab: normalizedLab } : {}),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}
