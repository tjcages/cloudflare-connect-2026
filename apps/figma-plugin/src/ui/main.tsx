import React from "react";
import { createRoot } from "react-dom/client";
import { PluginApp } from "./PluginApp";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PluginApp />
  </React.StrictMode>,
);
