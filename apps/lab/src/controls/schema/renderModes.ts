export const RENDER_MODE_INTENSITY: Record<string, number> = {
  abstract: 1,
  charcoal: 0.29,
  pencil: 1,
  brush: 1,
  halftone: 1,
  risograph: 1,
  stainedGlass: 1,
  paperCutout: 0.0,
  crt: 1,
  glitch: 1,
  vhs: 1,
  amber: 1,
  gummy: 1,
};

export const RENDER_MODE_COLORS: Record<
  string,
  { a: { label: string; def: string }; b: { label: string; def: string } }
> = {
  pencil: { a: { label: "Stroke color", def: "#222222" }, b: { label: "Paper color", def: "#faf9f5" } },
  amber: { a: { label: "Phosphor", def: "#ffae12" }, b: { label: "Screen", def: "#0a0500" } },
};

export const RENDER_MODE_PARAMS: Record<
  string,
  { key: string; label: string; def: number; px?: { min: number; max: number; step: number } }[]
> = {
  abstract: [
    { key: "abstractP0", label: "Wobble", def: 0.5 },
    { key: "abstractP1", label: "Grain", def: 0.5 },
    { key: "abstractP2", label: "Curviness", def: 0.5 },
  ],
  charcoal: [
    { key: "charcoalP0", label: "Grain", def: 0.08 },
    { key: "charcoalP1", label: "Smudge", def: 0.0 },
    { key: "charcoalP2", label: "Darkness", def: 0.0 },
  ],
  pencil: [
    { key: "pencilP0", label: "Hatch density", def: 0.6 },
    { key: "pencilP1", label: "Pressure", def: 0.6 },
    { key: "pencilP2", label: "Paper", def: 0.4 },
  ],
  brush: [
    { key: "brushP0", label: "Stroke", def: 0.5 },
    { key: "brushP1", label: "Bristle", def: 0.6 },
    { key: "brushP2", label: "Impasto", def: 0.4 },
  ],
  halftone: [
    { key: "halftoneP0", label: "Dot size", def: 6, px: { min: 2, max: 22, step: 1 } },
    { key: "halftoneP1", label: "Radius", def: 0.0 },
  ],
  risograph: [
    { key: "risographP0", label: "Misregister", def: 1.0 },
    { key: "risographP1", label: "Ink hue", def: 0.0 },
  ],
  stainedGlass: [
    { key: "stainedGlassP0", label: "Cell size", def: 16, px: { min: 6, max: 60, step: 1 } },
    { key: "stainedGlassP1", label: "Lead width", def: 0.0 },
    { key: "stainedGlassP2", label: "Saturation", def: 0.0 },
    { key: "stainedGlassP3", label: "Grid opacity", def: 1.0 },
  ],
  paperCutout: [
    { key: "paperCutoutP0", label: "Shadow", def: 0.0 },
    { key: "paperCutoutP1", label: "Posterize", def: 1.0 },
    { key: "paperCutoutP2", label: "Roughness", def: 0.0 },
  ],
  crt: [
    { key: "crtP0", label: "Scanlines", def: 0.6 },
    { key: "crtP1", label: "Aberration", def: 0.6 },
    { key: "crtP2", label: "Bloom", def: 0.5 },
  ],
  glitch: [
    { key: "glitchP0", label: "Slip", def: 0.5 },
    { key: "glitchP1", label: "Split", def: 0.5 },
    { key: "glitchP2", label: "Frequency", def: 0.4 },
  ],
  vhs: [
    { key: "vhsP0", label: "Tracking", def: 0.5 },
    { key: "vhsP1", label: "Chroma", def: 0.5 },
  ],
  amber: [
    { key: "amberP0", label: "Glow", def: 0.6 },
    { key: "amberP1", label: "Scanlines", def: 0.5 },
    { key: "amberP2", label: "Brightness", def: 0.5 },
    { key: "amberP3", label: "Cell size", def: 4, px: { min: 2, max: 16, step: 1 } },
  ],
  gummy: [
    { key: "gummyP0", label: "Blob size", def: 18, px: { min: 6, max: 48, step: 1 } },
    { key: "gummyP1", label: "Gloss", def: 0.6 },
    { key: "gummyP2", label: "Saturation", def: 0.6 },
  ],
};
