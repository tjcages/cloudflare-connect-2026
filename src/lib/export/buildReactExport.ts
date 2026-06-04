import { buildPortableExportFiles } from "./portableBundle";
import { snapshotToAsciiVideoConfig, type ReactExportSnapshot } from "./playgroundSnapshot";
import {
  resolveExportPaths,
  type ExportConvention,
  type FolderNaming,
  type ResolvedExportPaths,
} from "./resolveExportPaths";

export type ExportFile = {
  relativePath: string;
  language: string;
  content: string;
};

export type ReactExportBundle = {
  resolved: ResolvedExportPaths;
  files: ExportFile[];
  prerequisites: string;
  installInstructions: string;
  usageSnippet: string;
  astroUsage: string;
  aiInstructions: string;
};

const REACT_REQUIRED_MESSAGE =
  "This export only works in React projects. Add React to your app first, or choose a different integration.";

function generateTypesSource(snapshot: ReactExportSnapshot): string {
  const config = snapshotToAsciiVideoConfig(snapshot);
  const configJson = JSON.stringify(config, null, 2);

  return `export type Rgb01 = [number, number, number];

/** One luminosity stripe: a color shown for source cells at/above \`startFrom\`. */
export type Stripe = {
  hex: string;
  /** Wide-gamut CSS, e.g. "color(display-p3 r g b)". */
  p3Css: string;
  /** Lower luminance bound 0–1. */
  startFrom: number;
  /** Stripe thickness in px. */
  width: number;
};

export type StripeColors = { stripes: Stripe[] };

export type AsciiVideoConfig = {
  duotoneEnabled: boolean;
  sparkleGapsActivePercent?: number;
  sparkleGapsSpeed?: number;
  sparkleWidthActivePercent?: number;
  sparkleWidthSpeed?: number;
  displayWidth?: number;
  displayHeight?: number;
  stripes: Stripe[];
};

export type AsciiVideoProps = {
  /** Video or image URL */
  src: string;
  mediaKind?: "video" | "image";
  config?: AsciiVideoConfig;
  className?: string;
  style?: import("react").CSSProperties;
  autoplay?: boolean;
};

export const defaultConfig: AsciiVideoConfig = ${configJson};

export function configToStripeColors(config: AsciiVideoConfig): StripeColors {
  return { stripes: config.stripes };
}

export { hexToRgb01 } from "./colorSpace";
`;
}

function fence(language: string, content: string): string {
  return `\`\`\`${language}\n${content.trim()}\n\`\`\``;
}

const EXPORT_PARITY_STEPS = [
  "## 6b. Playground parity (required)",
  "",
  "The export matches the Section Grid Playground renderer. To get a **1:1** result:",
  "",
  "- Copy **every** file from step 6 into `ascii-video/` — including `scene.ts`, `pixi.tsx`, `pixiUtils.ts`, and the entire `runtime/` folder. Do not merge or simplify modules.",
  "- Use exported `defaultConfig` **unchanged** (stripe colors, `startFrom` thresholds, widths, `displayWidth` / `displayHeight`).",
  "- Use the **same media file** the user exported from, at a public URL/path the app can load with CORS (`crossOrigin` is set on the element).",
  "- Match `displayWidth` × `displayHeight` from `defaultConfig` — these are the logical canvas dimensions from the playground.",
  "- Add Berkeley Mono for stripe letters (required for correct glyphs):",
  "  1. Copy `BerkeleyMonoTrial-Regular.otf` into the target app's `public/fonts/` (or equivalent static assets folder).",
  "  2. Add to global CSS:",
  "",
  fence(
    "css",
    `@font-face {
  font-family: "Berkeley Mono Trial";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/BerkeleyMonoTrial-Regular.otf") format("opentype");
}`,
  ),
  "",
  "  The family name must be exactly `Berkeley Mono Trial` (see `runtime/stripeLetterFont.ts`).",
  "- Give the component wrapper an explicit height/width (or use `displayWidth` / `displayHeight` from config).",
  "- Do **not** rewrite the renderer, swap in a simplified canvas loop, or change stripe settings unless the user asks.",
].join("\n");

function buildUsageSnippet(resolved: ResolvedExportPaths): string {
  const importPath = `@/${resolved.directory}`;
  return `import { AsciiVideo } from "${importPath}";
import { defaultConfig } from "${importPath}/types";

export function Hero() {
  return (
    <AsciiVideo
      src="/path/to/your-media.mp4"
      mediaKind="video"
      config={defaultConfig}
      className="w-full"
      style={{ height: 400 }}
    />
  );
}
`;
}

function buildAstroPageSnippet(importPath: string): string {
  return `---
import { AsciiVideo } from "${importPath}";
import { defaultConfig } from "${importPath}/types";
---
<AsciiVideo client:load src="/path/to/your-media.mp4" config={defaultConfig} class="w-full" style={{ height: "400px" }} />`;
}

/** Plain description for Manual tab — not a copyable prompt. */
function buildManualAstroDescription(resolved: ResolvedExportPaths): string {
  return [
    "If your project uses Astro with an existing React integration (@astrojs/react or equivalent), you can use AsciiVideo as a client island on any .astro page.",
    "After unzipping the export into your repo, import AsciiVideo the same way you would in React, then add client:load or client:visible on the component — match how other React islands in your project are set up.",
    `Adjust import paths to where you placed the files (this export resolves to ${resolved.directory}/).`,
  ].join("\n\n");
}

function buildAiUserInstructions(astroSnippet: string): string {
  return [
    "## 9. Instructions for the user (relay only — do not implement Astro yourself)",
    "",
    "After step 8 passes, **tell the user** what to do next. Do **not** create or edit `.astro` files, `astro.config`, or Astro routes unless they explicitly ask you to.",
    "",
    "Check whether the target is an Astro project (`astro` in `package.json` or an `astro.config.*` file).",
    "",
    "**If Astro:** Explain that integration is complete on the React side, and **they** can drop the component into a page as a React island. Share this snippet for **them** to paste (they should fix import paths to match where you placed `ascii-video/`):",
    "",
    fence("astro", astroSnippet),
    "",
    "Also mention:",
    "- They need an existing Astro + React setup (`@astrojs/react` or equivalent).",
    "- They should mirror how other React islands in the project set `client:load` vs `client:visible`.",
    "- You did not wire Astro for them — this is their follow-up step.",
    "",
    "**If not Astro:** Do not mention Astro. End with a short summary of what you created and where.",
  ].join("\n");
}

const AI_LOCATION_STEPS = [
  "Search the repo for an existing React components folder. Prefer the first match:",
  "  - `src/components`",
  "  - `components`",
  "  - `app/components`",
  "  - or the project's established components directory",
  "Inside that folder, create **`ascii-video/`** (kebab-case) unless a folder named `ascii-video` or `AsciiVideo` already exists for this component.",
  "Do **not** ask the user where to put files — infer from the project layout.",
].join("\n");

const AI_ENTRY_FILE_STEPS = [
  "Inspect sibling folders in the chosen components directory.",
  "If most component folders use `index.tsx`, create `ascii-video/index.tsx` exporting `AsciiVideo`.",
  "Otherwise create `ascii-video/AsciiVideo.tsx`.",
  "Match existing import alias style (`@/components/...`, `~/components/...`, relative paths).",
].join("\n");

/** AI tab: fully automatic — no target path or convention from the user. */
export function buildAiInstructions(snapshot: ReactExportSnapshot): string {
  const files = buildManualFiles(snapshot, {
    targetDir: "src/components",
    convention: "folderIndex",
  });

  const fileSections = files
    .map((file) => `### \`${file.relativePath}\`\n\n${fence("typescript", file.content)}`)
    .join("\n\n");

  const integrateExample = `import { AsciiVideo } from "<your-alias>/ascii-video";
import { defaultConfig } from "<your-alias>/ascii-video/types";

export function Hero() {
  return (
    <AsciiVideo
      src="/path/to/your-media.mp4"
      mediaKind="video"
      config={defaultConfig}
      className="w-full"
      style={{ height: 400 }}
    />
  );
}`;

  const astroSnippetForUser = buildAstroPageSnippet("<relative-path-to>/ascii-video");

  return [
    "# Integrate AsciiVideo (exported from Section Grid Playground)",
    "",
    "## 1. Prerequisite: React required",
    "",
    "Inspect `package.json` for a `react` dependency.",
    "",
    `- If **missing**: stop immediately. Tell the user: "${REACT_REQUIRED_MESSAGE}" Do not create files or install packages.`,
    `- If **present**: continue below.`,
    "",
    "## 2. Objective",
    "",
    "Add the ASCII stripe video effect as `AsciiVideo` in the existing React app. Infer paths and conventions from the repo — do not ask the user for a target folder.",
    "",
    "## 3. Choose location (automatic)",
    "",
    AI_LOCATION_STEPS,
    "",
    "## 4. Entry file naming (automatic)",
    "",
    AI_ENTRY_FILE_STEPS,
    "",
    "## 5. Install dependencies",
    "",
    "```bash",
    "pnpm add pixi.js",
    "```",
    "",
    "Do **not** add `react`, `react-dom`, or `@types/react`.",
    "",
    "## 6. Create files",
    "",
    "Create **all** of the following files under the resolved `ascii-video` folder (adjust paths to match step 3–4). Keep the `runtime/` subdirectory:",
    "",
    fileSections,
    "",
    EXPORT_PARITY_STEPS,
    "",
    "## 7. Integrate",
    "",
    "Import `AsciiVideo`, pass `src` (video or image URL), use `defaultConfig` from `types.ts` unless the user specifies otherwise, and render client-only with explicit height.",
    "",
    fence("tsx", integrateExample),
    "",
    "## 8. Final verification (mandatory)",
    "",
    "Run the target project's lint and typecheck (e.g. `pnpm lint`, `pnpm typecheck`, or `tsc --noEmit`). Fix every ESLint/Prettier/Biome issue and TypeScript error. Re-run until clean. Follow existing import rules, React hooks rules, and client-component boundaries.",
    "",
    buildAiUserInstructions(astroSnippetForUser),
  ].join("\n");
}

function buildManualFiles(
  snapshot: ReactExportSnapshot,
  options: { targetDir: string; convention?: ExportConvention; folderNaming?: FolderNaming },
): ExportFile[] {
  const convention = options.convention ?? "folderIndex";
  const resolved = resolveExportPaths({
    targetDir: options.targetDir,
    convention: convention === "auto" ? "folderIndex" : convention,
    folderNaming: options.folderNaming,
  });

  return buildPortableExportFiles({
    directory: resolved.directory,
    entryFileName: resolved.entryFileName,
    typesContent: generateTypesSource(snapshot),
  });
}

export function buildReactExport(
  snapshot: ReactExportSnapshot,
  options: {
    targetDir: string;
    convention?: ExportConvention;
    folderNaming?: FolderNaming;
  },
): ReactExportBundle {
  const convention = options.convention ?? "folderIndex";
  const resolved = resolveExportPaths({
    targetDir: options.targetDir,
    convention: convention === "auto" ? "folderIndex" : convention,
    folderNaming: options.folderNaming,
  });

  const files = buildManualFiles(snapshot, options);

  const prerequisites = [
    "## Prerequisites",
    "",
    `- Target project **must already depend on React** (\`react\` in \`package.json\`).`,
    `- If React is missing: **do not proceed**. ${REACT_REQUIRED_MESSAGE}`,
  ].join("\n");

  const installInstructions = [
    "## Install",
    "",
    "```bash",
    "pnpm add pixi.js",
    "```",
    "",
    "- Do **not** install `react` or `react-dom` — they must already exist.",
    "- The canvas is client-only; give the parent an explicit height.",
    "- Pass `config` or use exported `defaultConfig` from `./types`.",
    "- Copy the Berkeley Mono `@font-face` from the AI instructions (or playground `global.css`) and place `BerkeleyMonoTrial-Regular.otf` in `public/fonts/`.",
    "- Install includes the full `ascii-video/` tree (`scene.ts`, `pixi.tsx`, `runtime/*`) — not just three files.",
  ].join("\n");

  const usageSnippet = buildUsageSnippet(resolved);
  const astroUsage = buildManualAstroDescription(resolved);

  return {
    resolved,
    files,
    prerequisites,
    installInstructions,
    usageSnippet,
    astroUsage,
    aiInstructions: buildAiInstructions(snapshot),
  };
}
