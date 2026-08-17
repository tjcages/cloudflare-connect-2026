import { createElement } from "react";
import { createRoot } from "react-dom/client";

import StripesStatsOverlay from "./StripesStatsOverlay";

const host = document.createElement("div");
document.body.appendChild(host);
createRoot(host).render(createElement(StripesStatsOverlay));
