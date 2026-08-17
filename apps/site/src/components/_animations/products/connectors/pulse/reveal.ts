import { scramble } from "@/components/scramble/engine";
import type { ScramblePreset } from "@/components/scramble/presets";
import { ripple } from "@/components/scramble/ripple";

const LABEL_PRESET: ScramblePreset = "blur-focus";

const revealed = new WeakSet<HTMLElement>();
const originalText = new WeakMap<HTMLElement, string>();

function labelTextEl(boxId: string) {
  return document
    .getElementById(boxId)
    ?.querySelector<HTMLElement>("[data-box-name-text]");
}

export function revealBoxLabel(boxId: string) {
  const textEl = labelTextEl(boxId);
  const label = textEl?.closest<HTMLElement>("[data-box-name]");
  if (!(label && textEl) || revealed.has(label)) return;
  revealed.add(label);

  originalText.set(textEl, textEl.textContent ?? "");
  scramble(textEl, LABEL_PRESET);
  label.setAttribute("data-revealed", "");
}

// Badges sit at the midpoint of the connector feeding their box, so they light
// up as the snake passes over them — once, then they stay.
export function revealConnectorBadge(boxId: string) {
  const badge = document.querySelector<HTMLElement>(
    `[data-connector-badge="${boxId}"]`
  );
  const textEl = badge?.querySelector<HTMLElement>(
    "[data-connector-badge-text]"
  );
  if (!(badge && textEl) || revealed.has(badge)) return;
  revealed.add(badge);

  badge.setAttribute("data-revealed", "");
  scramble(textEl, LABEL_PRESET);
}

export function rippleBoxLabel(boxId: string) {
  const textEl = labelTextEl(boxId);
  if (!textEl) return;

  const text = originalText.get(textEl) ?? textEl.textContent ?? "";
  originalText.set(textEl, text);
  ripple(textEl, text);
}
