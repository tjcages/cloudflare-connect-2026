import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Generates the case-studies shader textures (black frame + blurred glows +
// stacked white inner shadows) from plain logo SVGs. Blur/offset values bake in
// compensation for Chrome's box-blur approximation vs Figma's renderer — see
// the logo-shader-texture memory before touching them.
//
// Usage: tsx dev/textures/generate.ts [slug...]
// Without args, generates every story/_svg logo that has no texture yet.

type Placement = {
  coverage: number;
  dx: number;
  dy: number;
};

type Region = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const LOGO_DIR = "src/components/_pages/case-studies/story/_svg";
const OUT_DIR = "src/components/_pages/case-studies/cards/_textures";

const FRAME_W = 800;
const FRAME_H = 320;
const CENTER = { x: 400, y: 160 };

// coverage: how far the logo's tighter dimension overflows the frame (1 = exact
// fit). dx/dy nudge the placement off center in frame units.
const DEFAULTS: Placement = { coverage: 1.3, dx: 0, dy: 0 };
const OVERRIDES: Record<string, Partial<Placement>> = {
  bitso: { coverage: 0.85 },
  cybernews: { coverage: 0.72 },
  esl: { coverage: 0.82 },
  "mitsubishi-gas-chemical": { coverage: 0.78 },
};

const shadowFilter = (slug: string, region: Region, effectScale: number) => {
  const shadows = [
    { dy: 1, sigma: 1, alpha: 0.4, dodge: false },
    { dy: 2, sigma: 2, alpha: 0.16, dodge: false },
    { dy: 4, sigma: 4, alpha: 0.12, dodge: false },
    { dy: 8.8, sigma: 4.92, alpha: 0.12, dodge: false },
    { dy: 22, sigma: 13.12, alpha: 0.24, dodge: true },
    { dy: 35.2, sigma: 22.96, alpha: 0.24, dodge: true },
    { dy: 52.8, sigma: 36.08, alpha: 0.12, dodge: true },
  ];
  const steps = shadows
    .map(({ dy, sigma, alpha, dodge }, i) => {
      const prev = i === 0 ? "shape" : `effect${i}_innerShadow_${slug}`;
      const blend = dodge
        ? `<feComposite operator="arithmetic" k1="0" k2="1" k3="1" k4="0" in2="${prev}" result="effect${i + 1}_innerShadow_${slug}"/>`
        : `<feBlend mode="normal" in2="${prev}" result="effect${i + 1}_innerShadow_${slug}"/>`;
      return `<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="${dy * effectScale}"/>
<feGaussianBlur stdDeviation="${sigma * effectScale}"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${alpha} 0"/>
<feComposite in2="SourceAlpha" operator="in"/>
${blend}`;
    })
    .join("\n");
  return `<filter id="logo_${slug}" x="${region.x}" y="${region.y}" width="${region.w}" height="${region.h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 0.001 0" result="shape"/>
${steps}
</filter>`;
};

const GLOWS = [
  {
    opacity: 0.3,
    circle: 'cx="176" cy="-47" r="207"',
    region: { x: -87, y: -310, s: 526 },
    gradient: "translate(176 -47) rotate(90) scale(207 232.729)",
  },
  {
    opacity: 0.3,
    circle: 'cy="412" r="347"',
    region: { x: -403, y: 9, s: 806 },
    gradient: "translate(0 412) rotate(90) scale(347 390.13)",
  },
  {
    opacity: 0.2,
    circle: 'cx="710" cy="-56" r="287"',
    region: { x: 367, y: -399, s: 686 },
    gradient: "translate(710 -56) rotate(90) scale(287 322.672)",
  },
  {
    opacity: 0.3,
    circle: 'cx="552" cy="386" r="321"',
    region: { x: 175, y: 9, s: 754 },
    gradient: "translate(552 386) rotate(90) scale(321 360.898)",
  },
];

const glowMarkup = (slug: string) =>
  GLOWS.map(
    (
      { opacity, circle },
      i
    ) => `<g opacity="${opacity}" filter="url(#glow${i}_${slug})">
<circle ${circle} fill="url(#paint${i}_${slug})"/>
</g>`
  ).join("\n");

const glowDefs = (slug: string) =>
  GLOWS.map(
    (
      { region, gradient },
      i
    ) => `<filter id="glow${i}_${slug}" x="${region.x}" y="${region.y}" width="${region.s}" height="${region.s}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="22.96" result="effect1_foregroundBlur_${slug}"/>
</filter>
<radialGradient id="paint${i}_${slug}" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="${gradient}">
<stop stop-color="white"/>
<stop offset="1" stop-opacity="0"/>
</radialGradient>`
  ).join("\n");

function generate(slug: string) {
  const source = readFileSync(join(LOGO_DIR, `${slug}.svg`), "utf8");
  const viewBox = source
    .match(/viewBox="([\d.\s-]+)"/)?.[1]
    .split(/\s+/)
    .map(Number);
  const content = source.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1].trim();
  if (!viewBox || !content)
    throw new Error(`${slug}: could not parse logo svg`);

  const [minX, minY, logoW, logoH] = viewBox;
  const { coverage, dx, dy } = { ...DEFAULTS, ...OVERRIDES[slug] };
  // coverage >= 1 oversizes past the frame (cover); < 1 fits the mark inside it
  // with margins (contain) — solid marks turn into a lit wall when cropped.
  const scale =
    coverage >= 1
      ? coverage / Math.min(logoW / FRAME_W, logoH / FRAME_H)
      : coverage * Math.min(FRAME_W / logoW, FRAME_H / logoH);
  const w = logoW * scale;
  const h = logoH * scale;
  const x = CENTER.x + dx - w / 2;
  const y = CENTER.y + dy - h / 2;
  const region = { x, y, w, h: h + 56 };
  const effectScale = Math.max(0.25, Math.min(1, h / 700));

  const logo = content.replaceAll('fill="currentColor"', 'fill="white"');
  const transform = `translate(${x - minX * scale} ${y - minY * scale}) scale(${scale})`;

  const svg = `<svg width="1600" height="640" viewBox="0 0 ${FRAME_W} ${FRAME_H}" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_${slug})">
<rect width="${FRAME_W}" height="${FRAME_H}" fill="black"/>
${glowMarkup(slug)}
<g filter="url(#logo_${slug})">
<g transform="${transform}">
${logo}
</g>
</g>
</g>
<defs>
${shadowFilter(slug, region, effectScale)}
${glowDefs(slug)}
<clipPath id="clip0_${slug}">
<rect width="${FRAME_W}" height="${FRAME_H}" fill="white"/>
</clipPath>
</defs>
</svg>
`;
  writeFileSync(join(OUT_DIR, `${slug}.svg`), svg);
  return {
    slug,
    scale: Math.round(scale * 100) / 100,
    w: Math.round(w),
    h: Math.round(h),
  };
}

const existing = new Set(
  readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.replace(".svg", ""))
);
const slugs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(LOGO_DIR)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.replace(".svg", ""))
      .filter((slug) => !existing.has(slug));

for (const slug of slugs) console.log(generate(slug));
console.log(`generated ${slugs.length} texture(s)`);
