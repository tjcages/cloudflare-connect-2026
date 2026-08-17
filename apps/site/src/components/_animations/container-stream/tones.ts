export type SyntaxTone = "neutral" | "purple" | "orange" | "blue";

export const SYNTAX_TONES: Record<SyntaxTone, string> = {
  neutral: "color-mix(in oklab, var(--color-darker) 7%, transparent)",
  purple: "var(--color-dynamic-purple-6)",
  orange: "var(--color-dynamic-orange-6)",
  blue: "var(--color-dynamic-blue-6)",
};

// The crest colour a segment passes through before settling back: accents ride two
// steps up the dynamic ramp, neutrals have no ramp so they ride alpha instead.
// Both ramps invert in dark, so the tokens carry the theme. The neutral alpha is
// computed here rather than nested through a second color-mix — mixing a
// half-transparent colour into `transparent` does not interpolate the way it reads.
export const CREST_TONES: Record<SyntaxTone, (env: number) => string> = {
  neutral: (env) =>
    `color-mix(in oklab, var(--color-darker) ${7 + 15 * env}%, transparent)`,
  purple: (env) =>
    `color-mix(in oklab, var(--color-dynamic-purple-4) ${env * 100}%, var(--color-dynamic-purple-6))`,
  orange: (env) =>
    `color-mix(in oklab, var(--color-dynamic-orange-4) ${env * 100}%, var(--color-dynamic-orange-6))`,
  blue: (env) =>
    `color-mix(in oklab, var(--color-dynamic-blue-4) ${env * 100}%, var(--color-dynamic-blue-6))`,
};
