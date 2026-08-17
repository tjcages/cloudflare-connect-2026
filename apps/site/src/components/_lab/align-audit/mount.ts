import { runAlignAudit } from "./audit";

if (new URLSearchParams(location.search).has("align")) {
  addEventListener("load", () => {
    setTimeout(runAlignAudit, 600);
  });
}
