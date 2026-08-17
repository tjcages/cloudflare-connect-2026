export const CONTROL_DRAWER_IDS = [
  "General",
  "Texture Tone",
  "Texture Levels",
  "Texture Source",
  "Camera",
  "Shader config",
  "Twizzler",
  "Rain",
  "Connect Wave",
  "Connect Shape",
  "Connect Fill",
  "Connect Lines",
  "Connect Hatch",
  "Connect Particles",
  "Connect Colors",
  "Background",
  "Grid",
  "Reveal",
  "Stripes",
  "Background Stars",
  "Background Meteors",
  "Sparkle",
  "Letters",
  "Edge Mask",
  "Cursor Trail",
  "Click Wave",
  "Background Flames",
  "Colors",
  "Detailed settings",
] as const;

const CONTROL_DRAWER_STATE_KEY = "stripes-engine-lab-control-drawers-v1";

type ControlDrawerId = (typeof CONTROL_DRAWER_IDS)[number] | string;
type ControlDrawerState = Record<string, boolean>;

function readControlDrawerState(): ControlDrawerState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CONTROL_DRAWER_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as ControlDrawerState)
      : {};
  } catch {
    return {};
  }
}

function writeControlDrawerState(state: ControlDrawerState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONTROL_DRAWER_STATE_KEY,
      JSON.stringify(state)
    );
  } catch {
    /* ignore storage errors */
  }
}

export function loadControlDrawerOpen(
  id: ControlDrawerId,
  defaultOpen = false
): boolean {
  const state = readControlDrawerState();
  return typeof state[id] === "boolean" ? state[id] : defaultOpen;
}

export function saveControlDrawerOpen(
  id: ControlDrawerId,
  open: boolean
): void {
  const state = readControlDrawerState();
  state[id] = open;
  writeControlDrawerState(state);
}

export function loadControlDrawerSnapshot(): ControlDrawerState {
  return readControlDrawerState();
}

export function saveControlDrawerSnapshot(
  snapshot: Record<string, unknown> | undefined
): void {
  if (!snapshot) return;
  const next: ControlDrawerState = {};
  for (const [key, value] of Object.entries(snapshot)) {
    if (typeof value === "boolean") next[key] = value;
  }
  writeControlDrawerState(next);
}
