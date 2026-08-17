import { generateIconRegistry, writeIconDts } from "./generate";
import {
  DEFAULT_AMBIENT_DTS_PATH,
  DEFAULT_CSS_PATH,
  DEFAULT_DTS_PATH,
  DEFAULT_SVG_DIR,
} from "./registry";

const registry = generateIconRegistry(DEFAULT_SVG_DIR, DEFAULT_CSS_PATH);
writeIconDts(registry, DEFAULT_DTS_PATH, DEFAULT_AMBIENT_DTS_PATH);
console.log(`[icons] wrote types for ${Object.keys(registry).length} icon(s)`);
