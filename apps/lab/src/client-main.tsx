import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabApp } from "./LabApp";
import { consumeFactoryBootReset, loadEditTheme } from "./persistence";
import { applyPresetToStorage, findPresetByName, loadBuiltinPresets } from "./presets";
import "./index.css";
import "./playground.css";

/** Client / agency review: limited Leva panels, Banner 5:1 baseline, rain off. */
function bootClientPreview(): void {
  consumeFactoryBootReset();
  const banner = findPresetByName(loadBuiltinPresets(), "Banner 5:1");
  if (banner) {
    const config = structuredClone(banner.config) as typeof banner.config & {
      background?: { transparent?: boolean };
      sparkle?: { gaps?: { enabled?: boolean } };
      frames?: { enabled?: boolean };
    };
    if (!config.background) config.background = {};
    config.background.transparent = true;
    if (!config.sparkle) config.sparkle = {};
    if (!config.sparkle.gaps) config.sparkle.gaps = { enabled: false };
    config.sparkle.gaps.enabled = false;
    if (config.frames) config.frames.enabled = false;
    applyPresetToStorage({ ...banner, config });
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get("mode") !== "client") {
    url.searchParams.set("mode", "client");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

bootClientPreview();
document.documentElement.dataset.theme = loadEditTheme();
document.documentElement.dataset.labMode = "client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LabApp clientMode />
  </StrictMode>,
);
