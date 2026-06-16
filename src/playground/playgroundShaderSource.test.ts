import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYGROUND_SHADER_SOURCE,
  PLAYGROUND_SHADER_PRESETS,
  PLAYGROUND_SHADER_PRESET_CUSTOM_ID,
  RAYMARCH_PLAYGROUND_SHADER_SOURCE,
  resolvePlaygroundShaderPresetId,
  resolvePlaygroundShaderRenderSize,
  wrapShaderToyMainImage,
} from "./playgroundShaderSource";

describe("playgroundShaderSource", () => {
  it("ships the cheap layered waveforms as the default equation source", () => {
    expect(DEFAULT_PLAYGROUND_SHADER_SOURCE).toContain("void mainImage(out vec4 O, vec2 I)");
    // The default must stay raymarch-free (no 90-step march loop) so weak GPUs hit full frame rate.
    expect(DEFAULT_PLAYGROUND_SHADER_SOURCE).not.toContain("i++<9e1");
    expect(DEFAULT_PLAYGROUND_SHADER_SOURCE).toContain("const float AMPLITUDE");
    expect(DEFAULT_PLAYGROUND_SHADER_SOURCE).toContain("Tweakables");
  });

  it("keeps the heavy raymarch original available as a preset", () => {
    expect(RAYMARCH_PLAYGROUND_SHADER_SOURCE).toContain("tanh(O/9e2)");
    const ids = PLAYGROUND_SHADER_PRESETS.map((preset) => preset.id);
    expect(ids).toContain("raymarch");
    expect(PLAYGROUND_SHADER_PRESETS.find((preset) => preset.id === "raymarch")?.source).toBe(
      RAYMARCH_PLAYGROUND_SHADER_SOURCE,
    );
  });

  it("exposes a valid mainImage body in every preset with the default first", () => {
    expect(PLAYGROUND_SHADER_PRESETS[0]?.source).toBe(DEFAULT_PLAYGROUND_SHADER_SOURCE);
    for (const preset of PLAYGROUND_SHADER_PRESETS) {
      // ShaderToy mainImage entry point, allowing both `(out vec4 O, vec2 I)` and the verbose
      // `( out vec4 fragColor, in vec2 fragCoord )` signature used by ported shaders.
      expect(preset.source).toMatch(/void\s+mainImage\s*\(/);
      expect(preset.label.length).toBeGreaterThan(0);
    }
    expect(new Set(PLAYGROUND_SHADER_PRESETS.map((preset) => preset.id)).size).toBe(PLAYGROUND_SHADER_PRESETS.length);
  });

  it("ships an audio-reactive flames preset that reads the microphone FFT from iChannel0", () => {
    const preset = PLAYGROUND_SHADER_PRESETS.find((entry) => entry.id === "audioflames");
    expect(preset).toBeTruthy();
    expect(preset?.source).toContain("texture( iChannel0");
    expect(resolvePlaygroundShaderPresetId(preset!.source)).toBe("audioflames");
  });

  it("resolves preset ids from equation sources, ignoring surrounding whitespace", () => {
    expect(resolvePlaygroundShaderPresetId(DEFAULT_PLAYGROUND_SHADER_SOURCE)).toBe("waveforms");
    expect(resolvePlaygroundShaderPresetId(`\n${RAYMARCH_PLAYGROUND_SHADER_SOURCE}  \n`)).toBe("raymarch");
    expect(resolvePlaygroundShaderPresetId("void mainImage(out vec4 O, vec2 I) { O = vec4(1.); }")).toBe(
      PLAYGROUND_SHADER_PRESET_CUSTOM_ID,
    );
  });

  it("resolves saved shaders by source and keeps built-ins ahead of them", () => {
    const custom = "void mainImage(out vec4 O, vec2 I) { O = vec4(0.5); }";
    const saved = [
      { id: "mine", label: "Mine", source: custom, createdAt: 1 },
      { id: "dupe", label: "Dupe", source: DEFAULT_PLAYGROUND_SHADER_SOURCE, createdAt: 2 },
    ];
    expect(resolvePlaygroundShaderPresetId(`\n${custom}\n`, saved)).toBe("saved:mine");
    // A built-in match wins even when a saved shader has the same source.
    expect(resolvePlaygroundShaderPresetId(DEFAULT_PLAYGROUND_SHADER_SOURCE, saved)).toBe("waveforms");
    expect(resolvePlaygroundShaderPresetId("totally different", saved)).toBe(PLAYGROUND_SHADER_PRESET_CUSTOM_ID);
  });

  it("wraps ShaderToy mainImage bodies with uniforms and a main entry point", () => {
    const wrapped = wrapShaderToyMainImage("void mainImage(out vec4 O, vec2 I) { O = vec4(1.0); }");
    expect(wrapped).toContain("uniform float iTime;");
    expect(wrapped).toContain("uniform vec3 iResolution;");
    expect(wrapped).toContain("playgroundViewCoord");
    expect(wrapped).toContain("uniform sampler2D iChannel0;");
    expect(wrapped).toContain("void mainImage(out vec4 O, vec2 I) { O = vec4(1.0); }");
    expect(wrapped).toContain("mainImage(color, playgroundViewCoord(fragCoord));");
    expect(wrapped).toContain("finalColor = vec4(color.rgb, 1.0);");
  });
});

describe("resolvePlaygroundShaderRenderSize", () => {
  it("keeps displays within the native cap at their exact size", () => {
    expect(resolvePlaygroundShaderRenderSize(640, 360)).toEqual({ width: 640, height: 360 });
    expect(resolvePlaygroundShaderRenderSize(800, 450)).toEqual({ width: 800, height: 450 });
  });

  it("caps oversized displays to the native box while preserving aspect", () => {
    expect(resolvePlaygroundShaderRenderSize(1600, 900)).toEqual({ width: 800, height: 450 });
    expect(resolvePlaygroundShaderRenderSize(3200, 1800)).toEqual({ width: 800, height: 450 });
  });

  it("caps by the limiting dimension for non-16:9 aspects", () => {
    expect(resolvePlaygroundShaderRenderSize(900, 1800)).toEqual({ width: 225, height: 450 });
    expect(resolvePlaygroundShaderRenderSize(2000, 200)).toEqual({ width: 800, height: 80 });
  });

  it("never collapses to zero", () => {
    expect(resolvePlaygroundShaderRenderSize(1, 8192)).toEqual({ width: 1, height: 450 });
  });
});
