import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/global.css";
import { TexturePlayground } from "./TexturePlayground";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TexturePlayground />
  </StrictMode>,
);
