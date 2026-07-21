import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabApp } from "./LabApp";
import { loadEditTheme } from "./persistence";
import "./index.css";
import "./playground.css";

document.documentElement.dataset.theme = loadEditTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LabApp />
  </StrictMode>,
);
