import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabApp } from "./LabApp";
import { consumeFactoryBootReset, loadEditTheme } from "./persistence";
import { consumePresetQuery } from "./presets";
import "./index.css";
import "./playground.css";

consumeFactoryBootReset();
consumePresetQuery();
document.documentElement.dataset.theme = loadEditTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LabApp />
  </StrictMode>,
);
