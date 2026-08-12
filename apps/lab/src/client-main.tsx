import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabApp } from "./LabApp";
import { resolveClientBootPreset, applyClientLayout } from "./client/savedLayouts";
import { consumeFactoryBootReset, loadEditTheme } from "./persistence";
import "./index.css";
import "./playground.css";

/** Client / agency review: limited Leva panels; keep live storage on refresh. */
function bootClientPreview(): void {
  consumeFactoryBootReset();
  const preset = resolveClientBootPreset();
  if (preset) {
    const config = structuredClone(preset.config) as typeof preset.config & {
      background?: { transparent?: boolean; color?: number };
      sparkle?: { gaps?: { enabled?: boolean } };
      frames?: { enabled?: boolean };
    };
    // Keep stage readable for review unless the layout explicitly set transparency.
    if (!config.background) config.background = {};
    if (config.background.transparent !== true) {
      config.background.transparent = false;
      if (typeof config.background.color !== "number") config.background.color = 0xffffff;
    }
    if (config.frames) config.frames.enabled = false;
    applyClientLayout({ ...preset, config });
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
