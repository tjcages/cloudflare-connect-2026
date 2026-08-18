/**
 * Lift the shader dev-panel styling out of the lab's `playground.css` into a
 * standalone stylesheet the Connect site can import, so the site's cmd+shift+d
 * panel renders identically to the lab's.
 *
 * Usage: node scripts/extract-panel-css.mjs <src.css> <out.css>
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(process.argv[2], "utf8");

/**
 * Comments and quoted strings can contain braces, which would desync brace
 * matching. Mask them with spaces so offsets still line up with `src`.
 */
function maskLiterals(css) {
  const out = css.split("");
  let i = 0;
  while (i < css.length) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      for (let j = i; j < stop; j++) if (out[j] !== "\n") out[j] = " ";
      i = stop;
      continue;
    }
    if (css[i] === '"' || css[i] === "'") {
      const quote = css[i];
      let j = i + 1;
      while (j < css.length && css[j] !== quote) j += css[j] === "\\" ? 2 : 1;
      const stop = Math.min(j + 1, css.length);
      for (let k = i; k < stop; k++) if (out[k] !== "\n") out[k] = " ";
      i = stop;
      continue;
    }
    i++;
  }
  return out.join("");
}

const masked = maskLiterals(src);

// Split into top-level rules by brace matching over the masked copy.
const rules = [];
let depth = 0;
let start = 0;
for (let i = 0; i < masked.length; i++) {
  if (masked[i] === "{") {
    depth++;
  } else if (masked[i] === "}") {
    depth--;
    if (depth === 0) {
      rules.push({
        text: src.slice(start, i + 1),
        maskedText: masked.slice(start, i + 1),
      });
      start = i + 1;
    }
  }
}

const KEEP =
  /leva|stripe-colors|twizzler-gradient|library-color|hex-color|color-library|time-transport/i;
// Lab-shell layout has no counterpart on the site.
const DROP =
  /\.lab-shell|\.lab-client|playground-workflow|playground-canvas-size/;

const kept = [];
const darkVars = [];
for (const { text, maskedText } of rules) {
  const selEnd = maskedText.indexOf("{");
  // Drop any `;`-terminated at-statements (@import, @charset) that precede the
  // rule — they belong to the source file, not to this extract.
  const rawSel = text.slice(0, selEnd);
  const maskedSel = maskedText.slice(0, selEnd);
  const lastSemi = maskedSel.lastIndexOf(";");
  const sel = rawSel.slice(lastSemi + 1).trim();
  const maskedSelOnly = maskedSel.slice(lastSemi + 1);
  const body = text.slice(selEnd);
  const rule = `${sel} ${body}`.trim();

  if (/^:root/.test(maskedSelOnly.trim())) {
    // Keep only the --leva-* custom properties, flattening the dark set onto
    // the panel wrapper (this panel is always dark on the site).
    if (!/data-theme="dark"/.test(sel)) continue;
    const vars = body
      .slice(body.indexOf("{") + 1, body.lastIndexOf("}"))
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d.startsWith("--leva-"));
    if (vars.length) {
      // Appended after every other rule: the source's bare
      // `.playground-leva-panel` rule carries the *light* set at the same
      // specificity, so the dark set has to come last to win.
      darkVars.push(...vars);
    }
    continue;
  }

  if (!KEEP.test(maskedSelOnly) || DROP.test(maskedSelOnly)) continue;
  kept.push(rule);
}

const header = `/*
 * Connect shader dev-panel styling.
 *
 * GENERATED — do not edit by hand. Extracted from the lab's
 * \`apps/lab/src/playground.css\` (the section-grid-generator panel) so the
 * site's cmd+shift+d panel renders identically. The panel wrapper keeps the
 * \`.playground-leva-panel\` class these selectors are scoped to, and the dark
 * \`--leva-*\` set is flattened onto that wrapper because this panel is always
 * dark.
 *
 * Regenerate: node scripts/extract-panel-css.mjs \\
 *   apps/lab/src/playground.css \\
 *   apps/site/src/components/_pages/connect/panel/panel.css
 */
`;

if (darkVars.length) {
  // Several source blocks define the dark set; last declaration of each wins.
  const deduped = new Map();
  for (const decl of darkVars) {
    deduped.set(decl.slice(0, decl.indexOf(":")).trim(), decl);
  }
  kept.push(
    `.playground-leva-panel {\n  ${[...deduped.values()].join(";\n  ")};\n}`,
  );
}

writeFileSync(process.argv[3], `${header}\n${kept.join("\n\n")}\n`);
console.log(`kept ${kept.length} of ${rules.length} top-level rules`);
