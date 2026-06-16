/**
 * Microphone capture for the playground shader pipeline.
 *
 * Mirrors ShaderToy's audio channel layout: a width×2 RGBA texture where row 0 holds the FFT
 * frequency spectrum and row 1 holds the raw waveform. Shaders sample `iChannel0` exactly like
 * ShaderToy audio (e.g. `texture(iChannel0, vec2(x, 0.25)).x` reads the spectrum). The texture
 * data is grayscale (r=g=b=value, a=255) so the common `.x`/`.r` reads behave identically.
 */

/** Texture width (frequency bins / waveform samples). Matches ShaderToy's 512-wide audio channel. */
export const PLAYGROUND_AUDIO_TEXTURE_WIDTH = 512;

/** Texture height: row 0 = FFT spectrum, row 1 = waveform. */
export const PLAYGROUND_AUDIO_TEXTURE_HEIGHT = 2;

/** Analyser FFT size; frequencyBinCount is half of this, so 1024 yields 512 bins. */
const ANALYSER_FFT_SIZE = 1024;

/** Smoothing keeps the spectrum from flickering frame to frame. */
const ANALYSER_SMOOTHING = 0.8;

export type PlaygroundAudioStartResult = { ok: true } | { ok: false; error: string };

/**
 * Pack byte frequency + waveform arrays into a width×2 grayscale RGBA buffer.
 *
 * WebGL uploads the first data row at texture coordinate v≈0, so row 0 (the FFT) is what a
 * `texture(iChannel0, vec2(x, 0.25))` read returns and row 1 (the waveform) answers v≈0.75.
 * Pure and DOM-free so it is unit-testable without Web Audio.
 */
export function packAudioTextureData(
  frequency: ArrayLike<number>,
  waveform: ArrayLike<number>,
  width: number = PLAYGROUND_AUDIO_TEXTURE_WIDTH,
): Uint8Array {
  const safeWidth = Math.max(1, Math.floor(width));
  const data = new Uint8Array(safeWidth * PLAYGROUND_AUDIO_TEXTURE_HEIGHT * 4);
  for (let x = 0; x < safeWidth; x++) {
    const freq = clampByte(frequency[x] ?? 0);
    const wave = clampByte(waveform[x] ?? 128);
    const fftOffset = x * 4;
    data[fftOffset] = freq;
    data[fftOffset + 1] = freq;
    data[fftOffset + 2] = freq;
    data[fftOffset + 3] = 255;
    const waveOffset = (safeWidth + x) * 4;
    data[waveOffset] = wave;
    data[waveOffset + 1] = wave;
    data[waveOffset + 2] = wave;
    data[waveOffset + 3] = 255;
  }
  return data;
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 255) {
    return 255;
  }
  return value | 0;
}

type AudioContextConstructor = new () => AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Owns the microphone stream and analyser. Start/stop are driven by the UI; `update()` is called
 * once per render tick to read the latest spectrum/waveform into the packed texture buffer.
 */
export class PlaygroundAudioInput {
  readonly textureWidth = PLAYGROUND_AUDIO_TEXTURE_WIDTH;
  readonly textureHeight = PLAYGROUND_AUDIO_TEXTURE_HEIGHT;

  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyBytes: Uint8Array<ArrayBuffer> | null = null;
  private waveformBytes: Uint8Array<ArrayBuffer> | null = null;
  private textureData: Uint8Array | null = null;
  private starting = false;
  private lastErrorMessage: string | null = null;

  get active(): boolean {
    return this.analyser !== null;
  }

  get lastError(): string | null {
    return this.lastErrorMessage;
  }

  async start(): Promise<PlaygroundAudioStartResult> {
    if (this.active) {
      return { ok: true };
    }
    if (this.starting) {
      return { ok: false, error: "Microphone is already starting." };
    }
    const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    const AudioContextCtor = resolveAudioContextConstructor();
    if (!mediaDevices?.getUserMedia || !AudioContextCtor) {
      const error = "Microphone capture is not supported in this browser.";
      this.lastErrorMessage = error;
      return { ok: false, error };
    }

    this.starting = true;
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      const context = new AudioContextCtor();
      // Browsers may create the context suspended until a user gesture resumes it.
      if (context.state === "suspended") {
        await context.resume().catch(() => {});
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
      // Connect mic -> analyser only (no destination) so we tap the signal without echoing it.
      source.connect(analyser);

      this.stream = stream;
      this.context = context;
      this.source = source;
      this.analyser = analyser;
      this.frequencyBytes = new Uint8Array(analyser.frequencyBinCount);
      this.waveformBytes = new Uint8Array(analyser.fftSize);
      this.textureData = new Uint8Array(this.textureWidth * this.textureHeight * 4);
      this.lastErrorMessage = null;
      return { ok: true };
    } catch (error) {
      this.teardown();
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : error instanceof Error
            ? error.message
            : "Could not access the microphone.";
      this.lastErrorMessage = message;
      return { ok: false, error: message };
    } finally {
      this.starting = false;
    }
  }

  /** Read the latest audio frame into the packed texture buffer. Returns null when inactive. */
  update(): Uint8Array | null {
    const analyser = this.analyser;
    const frequencyBytes = this.frequencyBytes;
    const waveformBytes = this.waveformBytes;
    if (!analyser || !frequencyBytes || !waveformBytes || !this.textureData) {
      return null;
    }
    analyser.getByteFrequencyData(frequencyBytes);
    analyser.getByteTimeDomainData(waveformBytes);
    this.textureData = packAudioTextureData(frequencyBytes, waveformBytes, this.textureWidth);
    return this.textureData;
  }

  stop(): void {
    this.teardown();
  }

  private teardown(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.context) {
      void this.context.close().catch(() => {});
      this.context = null;
    }
    this.frequencyBytes = null;
    this.waveformBytes = null;
    this.textureData = null;
  }
}
