import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backupSavedShadersToFiles,
  deleteSavedShaderFile,
  loadFileSavedShaders,
  writeSavedShaderFile,
} from "./savedShaderFiles";
import type { PlaygroundSavedShader } from "./playgroundSavedShaders";

const shader = (id: string): PlaygroundSavedShader => ({
  id,
  label: `Shader ${id}`,
  source: "void mainImage(){}",
  createdAt: 1,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("savedShaderFiles", () => {
  it("loads the bundled library as an array (empty until files are committed)", () => {
    expect(Array.isArray(loadFileSavedShaders())).toBe(true);
  });

  it("returns true when the dev endpoint accepts a write", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(writeSavedShaderFile(shader("a"))).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/__playground/saved-shaders", expect.objectContaining({ method: "POST" }));
  });

  it("resolves false (never throws) when no dev endpoint is available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no server")));

    await expect(writeSavedShaderFile(shader("a"))).resolves.toBe(false);
    await expect(deleteSavedShaderFile("a")).resolves.toBe(false);
  });

  it("backs up every shader and reports the success count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const written = await backupSavedShadersToFiles([shader("a"), shader("b")]);
    expect(written).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
