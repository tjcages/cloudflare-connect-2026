import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/App.css";
import { ICON_BOX_TITLE_FONT_LOAD_SPEC } from "./fonts/iconBoxTitle";

async function bootstrap() {
  if (typeof document !== "undefined" && document.fonts?.load) {
    try {
      await document.fonts.load(ICON_BOX_TITLE_FONT_LOAD_SPEC);
    } catch {
      /* FontFace unavailable or blocked */
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
