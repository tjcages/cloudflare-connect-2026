import type { LabTextureKind } from "./textures";

export interface UploadTextureVariant {
  id: string;
  label: string;
  kind: LabTextureKind;
}

export interface UploadEntry {
  id: string;
  label: string;
  kind: LabTextureKind;
  defaultScale: number;
  createdAt: number;
  dark?: UploadTextureVariant;
}

const MANIFEST_KEY = "stripes-engine-lab-uploads";

export function addUpload(manifest: UploadEntry[], entry: UploadEntry): UploadEntry[] {
  return [...manifest.filter((e) => e.id !== entry.id), entry];
}

export function removeUpload(manifest: UploadEntry[], id: string): UploadEntry[] {
  return manifest.filter((e) => e.id !== id);
}

export function setDarkUpload(manifest: UploadEntry[], id: string, dark: UploadTextureVariant): UploadEntry[] {
  return manifest.map((entry) => (entry.id === id ? { ...entry, dark } : entry));
}

export function loadManifest(): UploadEntry[] {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UploadEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveManifest(manifest: UploadEntry[]): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    /* ignore quota errors */
  }
}
