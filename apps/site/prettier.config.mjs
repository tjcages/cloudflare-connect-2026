/**
 * Mirrors ultracite's Biome formatter settings (config/biome/core: javascript.formatter)
 * so output matches the previous Biome formatting almost byte-for-byte:
 *   trailingCommas "es5", semicolons "always", jsxQuoteStyle "double",
 *   arrowParentheses "always", lineWidth 80, indentWidth 2 (space), bracketSpacing.
 *
 * prettier-plugin-tailwindcss replaces Biome's `useSortedClasses` (same official
 * Tailwind order); functions list mirrors that rule's `functions` option.
 *
 * @type {import('prettier').Config}
 */
const config = {
  arrowParens: "always",
  bracketSpacing: true,
  printWidth: 80,
  proseWrap: "never",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  useTabs: false,

  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],

  // Tailwind v4: point the sorter at the CSS entrypoint (replaces tailwindConfig).
  tailwindStylesheet: "./src/styles/globals.css",
  tailwindFunctions: ["clsx", "cva", "tw", "twMerge", "cn", "twJoin", "tv"],

  overrides: [
    { files: "*.astro", options: { parser: "astro" } },
    // Biome's JSON formatter never added trailing commas; keep wrangler.jsonc /
    // tsconfig.jsonc etc. comma-free so strict JSON readers don't choke.
    { files: "*.jsonc", options: { trailingComma: "none" } },
  ],
};

export default config;
