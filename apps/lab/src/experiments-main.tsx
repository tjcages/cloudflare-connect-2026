import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExperimentsApp } from "./ExperimentsApp";
import "./experiments.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ExperimentsApp />
  </StrictMode>,
);
