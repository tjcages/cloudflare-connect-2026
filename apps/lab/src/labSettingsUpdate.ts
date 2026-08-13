import { normalizeLabSettings, type LabSettings } from "./persistence";

export function labSettingsEqual(left: LabSettings, right: LabSettings): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

/**
 * Merge a patch into lab settings without JSON-roundtripping through localStorage.
 * Returning `loadLabSettings()` after save ping-pongs IEEE slider floats (React #185 / CF-73).
 */
export function nextLabSettings(prev: LabSettings, patch: Partial<LabSettings>): LabSettings | null {
  const merged = normalizeLabSettings({ ...prev, ...patch });
  return labSettingsEqual(prev, merged) ? null : merged;
}
