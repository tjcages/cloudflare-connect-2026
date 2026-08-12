import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClientPreviewApp } from "./client/ClientPreviewApp";
import "./client/client.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientPreviewApp />
  </StrictMode>,
);
