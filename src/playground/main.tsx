import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/global.css";
import { VideoPlayground } from "./VideoPlayground";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VideoPlayground />
  </StrictMode>,
);
