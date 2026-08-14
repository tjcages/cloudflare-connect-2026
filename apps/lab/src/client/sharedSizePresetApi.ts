import type { SharedSizePreset, SharedSizePresetInput } from "../sharedSizePresets";

const SIZE_PRESETS_ENDPOINT = "/api/size-presets";

async function apiJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Shared size request failed.");
  }
  return body;
}

export async function loadSharedSizePresets(signal?: AbortSignal): Promise<SharedSizePreset[]> {
  const response = await fetch(SIZE_PRESETS_ENDPOINT, { signal, headers: { accept: "application/json" } });
  const body = await apiJson<{ presets: SharedSizePreset[] }>(response);
  return body.presets;
}

export async function createSharedSizePreset(input: SharedSizePresetInput): Promise<SharedSizePreset> {
  const response = await fetch(SIZE_PRESETS_ENDPOINT, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await apiJson<{ preset: SharedSizePreset }>(response);
  return body.preset;
}
