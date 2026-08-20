import { Gradient } from "modgrad";
import { badgeSwatchColors, type BadgeTheme } from "./badge-themes";
import "./BadgeThemeSwatch.css";

function swatchSeed(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) + 1;
}

export default function BadgeThemeSwatch({ theme }: { theme: BadgeTheme }) {
  return (
    <span className="badge-theme-swatch size-28 rounded-full">
      <Gradient
        animate={{ speed: 0.55 }}
        background={theme.deep}
        className="badge-theme-swatch__mesh"
        colors={[...badgeSwatchColors(theme)]}
        grain={0.26}
        grainScale={70}
        seed={swatchSeed(theme.id)}
        theme="light"
        variant="liquid"
        warp={{ detail: 2, intensity: 24, scale: 1.35 }}
      />
      <span className="badge-theme-swatch__sheen" />
    </span>
  );
}
