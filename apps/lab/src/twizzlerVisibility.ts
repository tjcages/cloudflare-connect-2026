export function shouldShowTwizzlerOverlay(textureSourceMode: "texture" | "shader", enabled: boolean): boolean {
  // Canvas ribbon underlay — available on any shader source when enabled
  // (Connect / Spiral / Twizzler Map). Matches the e32386e boot experience.
  return textureSourceMode === "shader" && enabled;
}
