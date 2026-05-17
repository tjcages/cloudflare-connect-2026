import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/App.css";
import { exposeSectionGridBuilderDevApi } from "./devExposeBuilderStorage";

if (import.meta.env.DEV) {
  window.__SECTION_GRID_BUILDER_DEV__ = exposeSectionGridBuilderDevApi();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
