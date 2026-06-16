/**
 * Browser/build integration for the file-backed saved-shader library in {@link ./savedShaderLibrary}.
 *
 * Reading: the JSON files are bundled at build time via {@link import.meta.glob}, so anyone who builds
 * or clones the project gets the committed shaders. Writing/deleting only works while the Vite dev
 * server is running — it exposes the `/__playground/saved-shaders` endpoint (see `vite.config.ts`).
 * In a static build the write calls fail gracefully and the app keeps using `localStorage`.
 */

import { normalizeSavedShader, type PlaygroundSavedShader } from "./playgroundSavedShaders";

/** Dev-only endpoint backed by the Vite plugin in `vite.config.ts`. */
export const SAVED_SHADER_FILE_API = "/__playground/saved-shaders";

const fileModules = import.meta.glob<unknown>("./savedShaderLibrary/*.json", {
  eager: true,
  import: "default",
});

/**
 * Saved shaders committed to the repo as files, normalized and ordered oldest-first. Bundled into the
 * build so they travel with the project.
 */
export function loadFileSavedShaders(): PlaygroundSavedShader[] {
  const seen = new Set<string>();
  const result: PlaygroundSavedShader[] = [];
  for (const raw of Object.values(fileModules)) {
    const normalized = normalizeSavedShader(raw);
    if (!normalized || seen.has(normalized.id)) {
      continue;
    }
    seen.add(normalized.id);
    result.push(normalized);
  }
  return result.sort((a, b) => a.createdAt - b.createdAt);
}

/** Write one shader to disk as `<id>.json`. Resolves false when the dev endpoint is unavailable. */
export async function writeSavedShaderFile(shader: PlaygroundSavedShader): Promise<boolean> {
  try {
    const response = await fetch(SAVED_SHADER_FILE_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(shader),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Remove the `<id>.json` file. Resolves false when the dev endpoint is unavailable. */
export async function deleteSavedShaderFile(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${SAVED_SHADER_FILE_API}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Best-effort write of every shader that is not already present as a file. Used to back up the
 * browser-only library to disk so nothing is lost. Returns the number of write attempts that succeeded.
 */
export async function backupSavedShadersToFiles(
  shaders: readonly PlaygroundSavedShader[],
  options: { onlyMissing?: boolean } = {},
): Promise<number> {
  const fileIds = options.onlyMissing ? new Set(loadFileSavedShaders().map((entry) => entry.id)) : null;
  let written = 0;
  for (const shader of shaders) {
    if (fileIds && fileIds.has(shader.id)) {
      continue;
    }
    if (await writeSavedShaderFile(shader)) {
      written += 1;
    }
  }
  return written;
}
