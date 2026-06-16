import { describe, expect, it } from "vitest";
import {
  PLAYGROUND_AUDIO_TEXTURE_HEIGHT,
  PLAYGROUND_AUDIO_TEXTURE_WIDTH,
  packAudioTextureData,
} from "./playgroundAudioInput";

describe("packAudioTextureData", () => {
  it("places the FFT spectrum in row 0 and the waveform in row 1 as grayscale RGBA", () => {
    const width = 4;
    const frequency = [10, 20, 30, 40];
    const waveform = [100, 110, 120, 130];
    const data = packAudioTextureData(frequency, waveform, width);

    expect(data.length).toBe(width * 2 * 4);
    for (let x = 0; x < width; x++) {
      const fft = x * 4;
      expect([data[fft], data[fft + 1], data[fft + 2], data[fft + 3]]).toEqual([
        frequency[x],
        frequency[x],
        frequency[x],
        255,
      ]);
      const wave = (width + x) * 4;
      expect([data[wave], data[wave + 1], data[wave + 2], data[wave + 3]]).toEqual([
        waveform[x],
        waveform[x],
        waveform[x],
        255,
      ]);
    }
  });

  it("defaults to the ShaderToy-style 512×2 texture and clamps/floors out-of-range values", () => {
    const data = packAudioTextureData([300, -5, NaN], [128]);
    expect(data.length).toBe(PLAYGROUND_AUDIO_TEXTURE_WIDTH * PLAYGROUND_AUDIO_TEXTURE_HEIGHT * 4);
    expect(PLAYGROUND_AUDIO_TEXTURE_HEIGHT).toBe(2);
    // Clamped high, clamped low, NaN -> 0.
    expect(data[0]).toBe(255);
    expect(data[4]).toBe(0);
    expect(data[8]).toBe(0);
    // Missing waveform samples fall back to the silent midpoint (128).
    const waveStart = PLAYGROUND_AUDIO_TEXTURE_WIDTH * 4;
    expect(data[waveStart]).toBe(128);
    expect(data[waveStart + 4]).toBe(128);
  });
});
