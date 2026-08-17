export type From = "left" | "center";

export type PresetConfig = {
  chars: string;
  from: From;
  override?: string;
  cursor?: string;
  revealRate: number;
  settleDuration: number;
  blur?: number;
  caretHold?: number;
};

export const SCRAMBLE_PRESETS = {
  eyebrow: {
    chars: "01",
    from: "left",
    override: "",
    cursor: "█",
    revealRate: 40,
    settleDuration: 140,
  },
  cipher: {
    chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    from: "left",
    override: "",
    cursor: "█",
    revealRate: 24,
    settleDuration: 200,
  },
  "eyebrow-hero": {
    chars: "01",
    from: "left",
    override: "",
    cursor: "█",
    revealRate: 42,
    settleDuration: 180,
    caretHold: 1200,
  },
  "blur-focus": {
    chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    from: "center",
    override: "",
    revealRate: 30,
    settleDuration: 340,
    blur: 2,
  },
  "hex-fast": {
    chars: "0123456789ABCDEF",
    from: "left",
    override: "",
    revealRate: 120,
    settleDuration: 80,
  },
  decrypt: {
    chars: "01",
    from: "left",
    override: "01",
    cursor: "█",
    revealRate: 85,
    settleDuration: 110,
  },
} satisfies Record<string, PresetConfig>;

export type ScramblePreset = keyof typeof SCRAMBLE_PRESETS;

export const RIPPLE_CHARS = "01";
export const RIPPLE_STEP_MS = 30;
export const RIPPLE_HOLD_MS = 105;

export const RAIN_CHARS = "01";
