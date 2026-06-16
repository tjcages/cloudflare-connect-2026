import { describe, expect, it } from "vitest";
import { PlaygroundShaderRenderer } from "./playgroundShaderSource";
import { packAudioTextureData, PLAYGROUND_AUDIO_TEXTURE_WIDTH } from "./playgroundAudioInput";

function canUseWebGL2(): boolean {
  const canvas = document.createElement("canvas");
  return Boolean(canvas.getContext("webgl2"));
}

/** Average brightness of the leftmost vs rightmost columns of a rendered frame. */
function edgeBrightness(image: ImageData): { left: number; right: number } {
  let left = 0;
  let right = 0;
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    const rowStart = y * image.width * 4;
    left += image.data[rowStart]!;
    right += image.data[rowStart + (image.width - 1) * 4]!;
    count += 1;
  }
  return { left: left / count, right: right / count };
}

describe("PlaygroundShaderRenderer audio channel", () => {
  it.skipIf(!canUseWebGL2())("samples uploaded audio data through iChannel0", () => {
    const renderer = new PlaygroundShaderRenderer();
    renderer.resize(64, 16);
    const compile = renderer.setSource(
      "void mainImage(out vec4 O, vec2 I){ float v = texture(iChannel0, vec2(I.x/iResolution.x, 0.25)).x; O = vec4(v, v, v, 1.0); }",
    );
    expect(compile.ok).toBe(true);

    // Spectrum ramps dark on the left to bright on the right.
    const frequency = new Uint8Array(PLAYGROUND_AUDIO_TEXTURE_WIDTH);
    for (let i = 0; i < frequency.length; i++) {
      frequency[i] = Math.round((i / (frequency.length - 1)) * 255);
    }
    const waveform = new Uint8Array(PLAYGROUND_AUDIO_TEXTURE_WIDTH).fill(128);
    const data = packAudioTextureData(frequency, waveform);

    renderer.setAudioTexture(data, PLAYGROUND_AUDIO_TEXTURE_WIDTH, 2);
    renderer.render(0);
    const withAudio = renderer.readNativeImageData();
    expect(withAudio).toBeTruthy();
    const lit = edgeBrightness(withAudio!);
    expect(lit.right).toBeGreaterThan(lit.left + 50);

    // Clearing restores the black default so iChannel0 reads zero again.
    renderer.setAudioTexture(null, 0, 0);
    renderer.render(0);
    const cleared = renderer.readNativeImageData();
    expect(cleared).toBeTruthy();
    const dark = edgeBrightness(cleared!);
    expect(dark.right).toBeLessThan(10);

    renderer.destroy();
  });
});
