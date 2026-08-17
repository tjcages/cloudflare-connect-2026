import {
  isSharedPresetKind,
  validateSharedPreset,
  validateSharedPresetInput,
  type SharedPreset,
  type SharedPresetInput,
  type SharedPresetKind,
} from "../sharedPresets";

const SHARED_PRESETS_ENDPOINT = "/api/presets";

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(response.ok ? "The server returned an invalid response." : "Shared preset request failed.");
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  return fallback;
}

async function apiJson(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const body = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(body, fallback));
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("The server returned an invalid response.");
  return body as Record<string, unknown>;
}

export async function loadSharedPresets<K extends SharedPresetKind>(
  kind: K,
  signal?: AbortSignal,
): Promise<SharedPreset<K>[]> {
  if (!isSharedPresetKind(kind)) throw new Error("Preset kind is invalid.");
  const response = await fetch(`${SHARED_PRESETS_ENDPOINT}?kind=${encodeURIComponent(kind)}`, {
    signal,
    headers: { accept: "application/json" },
  });
  const body = await apiJson(response, "Shared presets could not be loaded.");
  if (!Array.isArray(body.presets)) throw new Error("The server returned an invalid preset catalog.");
  return body.presets.map((candidate) => {
    const result = validateSharedPreset(candidate, kind);
    if (!result.ok) throw new Error(result.message);
    return result.value;
  });
}

export async function createSharedPreset<K extends SharedPresetKind>(
  input: SharedPresetInput<K>,
  signal?: AbortSignal,
): Promise<SharedPreset<K>> {
  const normalized = validateSharedPresetInput(input, input.kind);
  if (!normalized.ok) throw new Error(normalized.message);
  const response = await fetch(SHARED_PRESETS_ENDPOINT, {
    method: "POST",
    signal,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(normalized.value),
  });
  const body = await apiJson(response, "The shared preset could not be saved.");
  const result = validateSharedPreset(body.preset, input.kind);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export async function updateSharedPreset<K extends SharedPresetKind>(
  id: string,
  input: SharedPresetInput<K>,
  expectedRevision: number,
  signal?: AbortSignal,
): Promise<SharedPreset<K>> {
  const normalized = validateSharedPresetInput(input, input.kind);
  if (!normalized.ok) throw new Error(normalized.message);
  if (!id.trim()) throw new Error("Preset id is required.");
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new Error("Preset revision is invalid.");
  const { kind: _kind, ...update } = normalized.value;
  const response = await fetch(`${SHARED_PRESETS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PUT",
    signal,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ ...update, expectedRevision }),
  });
  const body = await apiJson(response, "The shared preset could not be updated.");
  const result = validateSharedPreset(body.preset, input.kind);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

export async function deleteSharedPreset(id: string, expectedRevision?: number, signal?: AbortSignal): Promise<void> {
  if (!id.trim()) throw new Error("Preset id is required.");
  if (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision < 1)) {
    throw new Error("Preset revision is invalid.");
  }
  const revisionQuery = expectedRevision === undefined ? "" : `?expectedRevision=${expectedRevision}`;
  const response = await fetch(`${SHARED_PRESETS_ENDPOINT}/${encodeURIComponent(id)}${revisionQuery}`, {
    method: "DELETE",
    signal,
    headers: { accept: "application/json" },
  });
  if (response.ok) return;
  const body = await readJson(response);
  throw new Error(errorMessage(body, "The shared preset could not be deleted."));
}
