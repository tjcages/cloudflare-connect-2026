import { buildLottieSvgRegistry, writeLottieSvgRegistry } from "./generate";
import {
  DEFAULT_CSS_PATH,
  DEFAULT_LOTTIE_DIR,
  DEFAULT_OUT_PATH,
} from "./registry";

const registry = buildLottieSvgRegistry(DEFAULT_LOTTIE_DIR, DEFAULT_CSS_PATH);
writeLottieSvgRegistry(registry, DEFAULT_OUT_PATH);
console.log(
  `[lottie-svg] generated ${Object.keys(registry).length} animation(s)`
);
