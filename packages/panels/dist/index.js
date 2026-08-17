import { createContext, useState, useEffect, useContext, useSyncExternalStore, useCallback, useRef, useLayoutEffect, useMemo, createElement } from 'react';
import { createPortal } from 'react-dom';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { canEncodeVideo, BufferTarget, Output, Mp4OutputFormat, CanvasSource } from 'mediabunny';
import { createRoot } from 'react-dom/client';

// src/overlay/projector.ts
function createLayer() {
  const layer = document.createElement("div");
  layer.className = "panel-overlay-layer";
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.overflow = "visible";
  return layer;
}
function createOverlayProjector(binding, options = {}) {
  if (typeof document === "undefined") {
    return { register: () => () => {
    }, destroy: () => {
    } };
  }
  const container2 = options.container ?? document.body;
  const layer = createLayer();
  container2.appendChild(layer);
  const anchors = /* @__PURE__ */ new Map();
  const hide = (node) => {
    node.style.visibility = "hidden";
  };
  const place = (entry) => {
    const { anchor } = entry;
    const node = anchor.node;
    if (anchor.visible === false) {
      if (entry.lastVisible) {
        hide(node);
        entry.lastVisible = false;
      }
      return;
    }
    const projected = binding.project(anchor.getWorld());
    if (!projected || !projected.visible) {
      if (entry.lastVisible) {
        hide(node);
        entry.lastVisible = false;
      }
      return;
    }
    const x = Math.round(projected.x);
    const y = Math.round(projected.y);
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    if (!entry.lastVisible) {
      node.style.visibility = "visible";
      entry.lastVisible = true;
    }
  };
  const tick2 = () => {
    for (const entry of anchors.values()) place(entry);
  };
  const stopFrame = binding.onFrame(tick2);
  const register = (anchor) => {
    const node = anchor.node;
    node.classList.add("panel-overlay-item");
    node.style.position = "absolute";
    node.style.top = "0";
    node.style.left = "0";
    node.style.willChange = "transform";
    node.style.visibility = "hidden";
    layer.appendChild(node);
    const entry = { anchor, lastVisible: false };
    anchors.set(anchor.id, entry);
    place(entry);
    return () => {
      const current2 = anchors.get(anchor.id);
      if (current2 && current2.anchor === anchor) {
        anchors.delete(anchor.id);
        if (node.parentNode === layer) layer.removeChild(node);
      }
    };
  };
  const destroy = () => {
    stopFrame();
    anchors.clear();
    if (layer.parentNode) layer.parentNode.removeChild(layer);
  };
  return { register, destroy };
}

// src/persist.ts
var PERSIST_PREFIX = "panels:";
var SECTIONS_SUFFIX = ":sections";
function storage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function loadPersistedPanelValues(id, defaults) {
  const s = storage();
  if (!s) return { ...defaults };
  try {
    const raw = s.getItem(PERSIST_PREFIX + id);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...defaults };
    const next = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (key in parsed && parsed[key] !== void 0) {
        next[key] = parsed[key];
      }
    }
    return next;
  } catch {
    return { ...defaults };
  }
}
function persistPanelValues(id, values) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PERSIST_PREFIX + id, JSON.stringify(values));
  } catch {
  }
}
function clearPersistedPanelValues(id) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(PERSIST_PREFIX + id);
  } catch {
  }
}
function hasPersistedPanelValues(id) {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(PERSIST_PREFIX + id) !== null;
  } catch {
    return false;
  }
}
function sectionsStorageKey(id) {
  return PERSIST_PREFIX + id + SECTIONS_SUFFIX;
}
function loadPersistedPanelSections(id) {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(sectionsStorageKey(id));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out = {};
    for (const [title, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") out[title] = value;
    }
    return out;
  } catch {
    return {};
  }
}
function persistPanelSections(id, sections) {
  const s = storage();
  if (!s) return;
  try {
    if (Object.keys(sections).length === 0) {
      s.removeItem(sectionsStorageKey(id));
      return;
    }
    s.setItem(sectionsStorageKey(id), JSON.stringify(sections));
  } catch {
  }
}
function clearPersistedPanelSections(id) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(sectionsStorageKey(id));
  } catch {
  }
}

// src/lib/cn.ts
function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}
function ControlToggleGroup({
  label,
  value,
  options,
  onChange,
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-toggle-group", className), children: [
    label ? /* @__PURE__ */ jsx("span", { className: "panel-toggle-group-label", children: label }) : null,
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-toggle-group-track",
        role: "group",
        "aria-label": label,
        children: options.map((o) => {
          const isSelected = String(o.value) === String(value);
          return /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: "panel-toggle-group-btn",
              "data-panel-active": isSelected ? "true" : "false",
              "aria-pressed": isSelected,
              "aria-label": o.label ?? String(o.value),
              title: o.label,
              onClick: () => onChange(o.value),
              children: [
                o.icon ? /* @__PURE__ */ jsx("span", { className: "panel-toggle-group-icon", "aria-hidden": "true", children: o.icon }) : null,
                o.label ? /* @__PURE__ */ jsx("span", { className: "panel-toggle-group-text", children: o.label }) : null
              ]
            },
            String(o.value)
          );
        })
      }
    )
  ] });
}
var PANEL_THEME_STORAGE_KEY = "shader-dev-theme";
function applyPanelTheme(mode, storageKey = PANEL_THEME_STORAGE_KEY) {
  if (typeof document === "undefined") return;
  window.__themeOverride = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    sessionStorage.setItem(storageKey, mode);
  } catch {
  }
}
function detectSystemPreference() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function usePanelTheme(defaultTheme) {
  const [systemPreference, setSystemPreference] = useState(detectSystemPreference);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e) => {
      setSystemPreference(e.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [htmlDark, setHtmlDark] = useState(false);
  useEffect(() => {
    const root2 = document.documentElement;
    const sync = () => setHtmlDark(root2.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root2, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  if (htmlDark) return "dark";
  if (defaultTheme) return defaultTheme;
  return systemPreference;
}
var PanelThemeContext = createContext("dark");
var PanelThemeProvider = PanelThemeContext.Provider;
function usePanelThemeContext() {
  return useContext(PanelThemeContext);
}
function ControlThemeToggle({
  className,
  storageKey
}) {
  const theme = usePanelTheme();
  return /* @__PURE__ */ jsx(
    ControlToggleGroup,
    {
      className: cn("panel-theme-toggle", className),
      value: theme,
      onChange: (v) => applyPanelTheme(v, storageKey),
      options: [
        { value: "light", icon: /* @__PURE__ */ jsx(SunIcon, {}) },
        { value: "dark", icon: /* @__PURE__ */ jsx(MoonIcon, {}) }
      ]
    }
  );
}
function SunIcon() {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "4", strokeWidth: "2" }),
    /* @__PURE__ */ jsx(
      "path",
      {
        strokeWidth: "2",
        strokeLinecap: "round",
        d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      }
    )
  ] });
}
function MoonIcon() {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx(
    "path",
    {
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    }
  ) });
}

// src/styles.ts
var PANEL_STYLE_ID = "shader-dev-styles";
var PANEL_CSS = `
[data-panel] {
  --panel-bg: rgba(13, 13, 16, 0.95);
  --panel-border: rgba(255, 255, 255, 0.16);
  --panel-text: #ffffff;
  --panel-text-muted: rgba(255, 255, 255, 0.72);
  --panel-surface: rgba(255, 255, 255, 0.05);
  --panel-surface-active: rgba(255, 255, 255, 0.15);
  --panel-toggle-hover: var(--panel-surface-active);
  --panel-surface-idle-fill: rgba(255, 255, 255, 0.11);
  --panel-hash: rgba(255, 255, 255, 0.15);
  --panel-handle: #ffffff;
  --panel-label: rgba(255, 255, 255, 0.7);
  --panel-label-active: #ffffff;
  --panel-divider: rgba(255, 255, 255, 0.06);
  --panel-muted-icon: rgba(255, 255, 255, 0.4);
  --panel-swatch-border: rgba(255, 255, 255, 0.2);
  --panel-kbd-bg: rgba(255, 255, 255, 0.1);
  --panel-action-bg: rgba(255, 255, 255, 0.05);
  --panel-action-bg-hover: rgba(255, 255, 255, 0.1);
  --panel-action-text: rgba(255, 255, 255, 0.72);
  --panel-action-text-hover: #ffffff;
  --panel-danger: #f87171;
  --panel-danger-hover: #fca5a5;
  --panel-header-border: rgba(255, 255, 255, 0.096);
  --panel-close-icon: rgba(255, 255, 255, 0.72);
  --panel-close-icon-hover: #ffffff;
  --panel-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
}

[data-panel][data-panel-theme="light"] {
  --panel-bg: rgba(255, 255, 255, 0.95);
  --panel-border: #d1d5db;
  --panel-text: #111827;
  --panel-text-muted: #4b5563;
  --panel-surface: #f3f4f6;
  --panel-surface-active: #d1d5db;
  --panel-toggle-hover: rgba(17, 24, 39, 0.04);
  --panel-surface-idle-fill: #e5e7eb;
  --panel-hash: #d1d5db;
  --panel-handle: #111827;
  --panel-label: #374151;
  --panel-label-active: #111827;
  --panel-divider: #e5e7eb;
  --panel-muted-icon: #9ca3af;
  --panel-swatch-border: #d1d5db;
  --panel-kbd-bg: #e5e7eb;
  --panel-action-bg: #f3f4f6;
  --panel-action-bg-hover: #e5e7eb;
  --panel-action-text: #374151;
  --panel-action-text-hover: #111827;
  --panel-danger: #dc2626;
  --panel-danger-hover: #b91c1c;
  --panel-header-border: #e5e7eb;
  --panel-close-icon: #6b7280;
  --panel-close-icon-hover: #111827;
}

[data-panel],
[data-panel] *,
[data-panel] *::before,
[data-panel] *::after {
  box-sizing: border-box;
}

/* Chrome elements shouldn't be selectable \u2014 labels, titles, buttons. Only
   inputs and the prompt code block opt back in via the override below. */
[data-panel] {
  -webkit-user-select: none;
  user-select: none;
}
[data-panel] input,
[data-panel] textarea,
[data-panel] .panel-prompt-pre,
[data-panel] .panel-paste-textarea,
[data-panel] .panel-text-input,
[data-panel] .panel-textarea-input,
[data-panel] .panel-search-input {
  -webkit-user-select: text;
  user-select: text;
}

[data-panel] button:not([class]) {
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  font-family: inherit;
  /* Intentionally NOT inheriting font-size \u2014 leaves component classes free to
     set their own without losing to specificity. */
  color: inherit;
  cursor: pointer;
}

/* All panel chrome buttons carry panel-* classes \u2014 zero host-app borders
   (Tailwind preflight, browser defaults, etc.) before component styles apply. */
[data-panel] button[class*="panel-"] {
  border: 0;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}

[data-panel] input,
[data-panel] select,
[data-panel] textarea {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: inherit;
  border: 0;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}

[data-panel] input.panel-color-text {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: var(--panel-label);
}

.panel-floating {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  bottom: 16px;
  z-index: 9999;
  display: flex;
  width: 280px;
  flex-direction: column;
  opacity: 1;
  filter: blur(0);
  transition-property: transform, opacity, filter;
  transition-duration: 280ms, 200ms, 200ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1), ease-in, ease-in;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.panel-floating[data-panel-side="left"] { left: 16px; }
.panel-floating[data-panel-side="right"] { right: 16px; }
.panel-floating[data-panel-collapsed="true"][data-panel-side="left"] { transform: translateX(calc(-100% - 16px)); }
.panel-floating[data-panel-collapsed="true"][data-panel-side="right"] { transform: translateX(calc(100% + 16px)); }
.panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) {
  opacity: 0;
  filter: blur(4px);
  pointer-events: none;
}

/* Peek preview \u2014 a scaled-down sliver slides in when the viewport edge is
   hovered while collapsed. Overrides the fully-hidden collapsed transform. */
.panel-floating[data-panel-collapsed="true"][data-panel-peek="true"] { cursor: pointer; }
.panel-floating[data-panel-collapsed="true"][data-panel-peek="true"][data-panel-side="right"] {
  transform: translateX(calc(100% - 56px)) scale(0.9);
  transform-origin: right center;
  opacity: 1;
  filter: blur(0);
  pointer-events: auto;
}
.panel-floating[data-panel-collapsed="true"][data-panel-peek="true"][data-panel-side="left"] {
  transform: translateX(calc(-100% + 56px)) scale(0.9);
  transform-origin: left center;
  opacity: 1;
  filter: blur(0);
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  .panel-floating { transition: none; }
  .panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) {
    opacity: 0;
    filter: none;
  }
  .panel-panel,
  .panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) .panel-panel {
    transition: none;
    opacity: 1;
    transform: none;
  }
}

.panel-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  color: var(--panel-text);
  box-shadow: var(--panel-shadow);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-property: opacity, transform;
  transition-duration: 220ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) .panel-panel {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  transition-timing-function: ease-in;
  transition-duration: 180ms;
}

/* Invisible hover/click strip pinned to the viewport edge \u2014 reveals the peek
   (and reopens on click) while the panel is collapsed. */
.panel-edge-sensor {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 24px;
  z-index: 9998;
  cursor: pointer;
}
.panel-edge-sensor[data-panel-side="right"] { right: 0; }
.panel-edge-sensor[data-panel-side="left"] { left: 0; }
.panel-edge-sensor[data-panel-inline="true"] { display: none; }

/* Inline panels (ToolShell) use absolute positioning within the overlay. */
.panel-floating[data-panel-inline="true"] {
  position: absolute;
  z-index: 20;
}

/* Transparent click-catcher over the peeking panel \u2014 any click opens it fully
   instead of hitting a control in the scaled-down preview. */
.panel-peek-catch {
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
}

.panel-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--panel-header-border);
  padding: 10px 12px 6px 12px;
}
.panel-panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.panel-panel-title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-panel-header-end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}
/* Header variant of the toggle group \u2014 compact, icon-only, non-growing. */
.panel-toggle-group.panel-theme-toggle {
  width: auto;
  padding: 0;
}
.panel-toggle-group.panel-theme-toggle .panel-toggle-group-track {
  gap: 2px;
  padding: 2px;
}
[data-panel] .panel-toggle-group.panel-theme-toggle .panel-toggle-group-btn {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
}
.panel-switcher {
  appearance: none;
  -webkit-appearance: none;
  border: 1px solid var(--panel-border);
  background: var(--panel-surface);
  color: var(--panel-text);
  border-radius: 6px;
  padding: 2px 22px 2px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 11px) 50%, calc(100% - 7px) 50%;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
  max-width: 110px;
  text-overflow: ellipsis;
  overflow: hidden;
}
.panel-switcher:focus { outline: 2px solid var(--panel-handle); outline-offset: 1px; }

.panel-close-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--panel-close-icon);
  transition-property: color, scale;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
.panel-close-btn::before {
  content: "";
  position: absolute;
  inset: -10px;
}
.panel-close-btn:active {
  scale: 0.96;
}
.panel-close-btn:hover { color: var(--panel-close-icon-hover); }
.panel-close-btn svg { width: 16px; height: 16px; }

.panel-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.panel-panel-body::-webkit-scrollbar { display: none; }

.panel-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

/* Animation transport \u2014 pinned at the top of the panel body. */
.panel-animation {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--panel-divider);
}
.panel-animation-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-animation-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
[data-panel] .panel-animation-btn {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--panel-action-text);
  background: var(--panel-action-bg);
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-animation-btn svg {
  width: 14px;
  height: 14px;
}
[data-panel] .panel-animation-btn:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-animation-btn-primary {
  width: 36px;
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-animation-btn-primary:hover {
  background: var(--panel-handle);
  color: #ffffff;
}
[data-panel] .panel-animation-btn-reset {
  margin-left: auto;
}
.panel-animation-time {
  flex: 1;
  min-width: 0;
  padding: 0 6px;
  font-family: inherit;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--panel-text-muted);
  text-align: center;
}

.panel-shortcut-hint {
  font-size: 12px;
  color: var(--panel-text-muted);
}
.panel-shortcut-hint kbd {
  border-radius: 4px;
  padding: 0 4px;
  font-family: inherit;
  background: var(--panel-kbd-bg);
}

.panel-actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--panel-divider);
  padding-top: 12px;
}

.panel-export-format-row {
  display: flex;
  gap: 6px;
}
.panel-export-format-row .panel-action-btn {
  flex: 1;
  min-width: 0;
}

/* Scoped under [data-panel] to beat the global button reset on
   specificity \u2014 otherwise the always-on light gray fill loses. */
[data-panel] .panel-action-btn {
  width: 100%;
  height: 36px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  transition-property: background-color, color, scale;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
[data-panel] .panel-action-btn:active:not(:disabled) {
  scale: 0.96;
}
[data-panel] .panel-action-btn:hover:not(.panel-action-btn-primary):not(:disabled) {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
[data-panel] .panel-action-btn-primary {
  background: var(--panel-handle);
  color: var(--panel-bg);
  border-color: transparent;
}
[data-panel] .panel-action-btn-primary:hover:not(:disabled) {
  background: var(--panel-handle);
  filter: brightness(1.08);
  color: var(--panel-bg);
}
[data-panel] .panel-action-btn-destructive {
  background: color-mix(in srgb, var(--panel-danger) 10%, var(--panel-action-bg));
  color: var(--panel-danger);
}
[data-panel] .panel-action-btn-destructive:hover:not(:disabled) {
  background: color-mix(in srgb, var(--panel-danger) 16%, var(--panel-action-bg-hover));
  color: var(--panel-danger-hover);
}

.panel-action-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.panel-action-group .panel-action-field {
  min-width: 0;
}
.panel-action-group .panel-action-btn {
  width: 100%;
  padding-left: 8px;
  padding-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-action-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-status {
  padding: 0 4px;
  font-size: 12px;
  color: var(--panel-text-muted);
}

/* Export group \u2014 pinned at the top of the actions block, separated from the
   JSON/reset buttons by a hairline divider. */
.panel-export {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--panel-divider);
}
.panel-export-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-export-row {
  display: flex;
  gap: 6px;
}
.panel-export-row .panel-action-btn {
  flex: 1;
}
.panel-export-hint {
  font-size: 11px;
  line-height: 1.35;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-export-gif {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--panel-divider);
}
.panel-export-gif-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-export-gif-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: var(--panel-surface);
}
[data-panel] .panel-export-gif-row .panel-export-res-btn {
  flex: 1 1 0;
  min-width: 0;
}

/* Segmented resolution selector for the hi-res PNG. */
.panel-export-res-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.panel-export-res {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  background: var(--panel-surface);
}
[data-panel] .panel-export-res-screen .panel-export-res-btn,
[data-panel] .panel-export-res-print .panel-export-res-btn {
  flex: 1 1 0;
  min-width: 0;
}
[data-panel] .panel-export-res-btn {
  min-width: 2.75rem;
  height: 26px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--panel-text-muted);
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-export-res-btn:hover {
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-export-res-active,
[data-panel] .panel-export-res-active:hover {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-export-rec,
[data-panel] .panel-export-rec:hover {
  background: #e5484d;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.panel-export-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ffffff;
  animation: panel-export-pulse 1s ease-in-out infinite;
}
@keyframes panel-export-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .panel-export-dot { animation: none; }
}

/* Auto-height animation via CSS Grid: parent transitions
   grid-template-rows between 0fr and 1fr, child clips overflow. */
.panel-collapse {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition: grid-template-rows 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.panel-collapse[data-panel-open="true"] {
  grid-template-rows: 1fr;
  overflow: visible;
}
.panel-collapse-inner {
  /* Vertical clipping only \u2014 height animation still collapses, but horizontal
     overshoot (slider overscroll spring, toggle row full-bleed hover) is not
     cropped. inset(-16px 0) regressed toggle hovers (white side gutters). */
  clip-path: inset(0 -9999px);
  min-height: 0;
  min-width: 0;
  opacity: 0;
  transition: opacity 200ms ease;
}
.panel-collapse[data-panel-open="true"] > .panel-collapse-inner {
  opacity: 1;
  transition: opacity 200ms ease 80ms;
}

.panel-saved-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 4px 2px;
  font-size: 11px;
  font-weight: 500;
  color: var(--panel-text-muted);
}
.panel-saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);
  flex-shrink: 0;
}

.panel-paste {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}
/* Scoped under [data-panel] to beat the global textarea reset on
   specificity \u2014 otherwise the explicit small font-size loses. */
[data-panel] .panel-paste-textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--panel-text);
  border: 1px solid var(--panel-border);
  font-family: inherit;
  font-size: 10px;
  line-height: 1.5;
  outline: none;
  transition: border-color 150ms ease;
}
[data-panel] .panel-paste-textarea:focus {
  border-color: var(--panel-handle);
}
[data-panel] .panel-paste-textarea::placeholder {
  color: var(--panel-muted-icon);
}
.panel-paste-error {
  padding: 0 4px;
  font-size: 11px;
  color: #ef4444;
}

.panel-empty {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9998;
  max-width: 280px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--panel-text-muted);
  padding: 12px;
  font-size: 13px;
  box-shadow: var(--panel-shadow);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.panel-empty-close {
  margin-top: 8px;
  display: block;
  width: 100%;
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--panel-action-bg);
  color: var(--panel-text);
  font-size: 13px;
}
.panel-empty-close:hover { background: var(--panel-action-bg-hover); }

.panel-section {
  border-top: 1px solid var(--panel-divider);
}
.panel-section:first-child { border-top: 0; }
.panel-section-header {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 4px;
  padding: 12px 0 8px;
}
.panel-section:first-child .panel-section-header { padding-top: 2px; }
.panel-section-button {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  height: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  text-align: left;
}
.panel-section-button:hover { color: var(--panel-label-active); }
.panel-section-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-section-caret-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--panel-muted-icon);
  flex-shrink: 0;
  transition: color 150ms ease, background-color 150ms ease;
}
.panel-section-caret-btn:hover { color: var(--panel-label-active); background: var(--panel-surface); }
.panel-section-caret {
  width: 12px;
  height: 12px;
  transition: transform 200ms ease;
}
.panel-section[data-panel-open="true"] .panel-section-caret { transform: rotate(180deg); }
.panel-section-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--panel-muted-icon);
  opacity: 0;
  transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease;
  flex-shrink: 0;
}
.panel-section-reset svg { width: 12px; height: 12px; }
.panel-section-header:hover .panel-section-reset,
.panel-section-reset:focus-visible { opacity: 1; }
.panel-section-reset:hover {
  color: var(--panel-label-active);
  background: var(--panel-surface);
}
.panel-section-children {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  overflow: visible;
}

.panel-field {
  min-width: 0;
  overflow: visible;
}

.panel-field-description {
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--panel-label-muted);
  padding: 4px 4px 2px;
  letter-spacing: 0.01em;
}

[data-panel] .panel-slider {
  position: relative;
  height: 36px;
  width: 100%;
  margin: 0;
  overflow: visible;
  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
[data-panel] .panel-slider[data-panel-state="hover"] { transform: scale(1.01); }
[data-panel] .panel-slider[data-panel-state="drag"] { transform: scale(1.018); }

.panel-slider-overscroll {
  position: absolute;
  inset: 0;
  transform: scaleX(var(--panel-os-scale, 1));
  transform-origin: var(--panel-os-origin, 50% 50%);
}
.panel-slider-overscroll[data-panel-release="true"] {
  transition: transform 320ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
@media (prefers-reduced-motion: reduce) {
  .panel-slider-overscroll[data-panel-release="true"] { transition: none; }
  [data-panel] .panel-slider { transition: none; }
}

.panel-slider-track {
  position: absolute;
  inset: 0;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  touch-action: none;
  border-radius: 8px;
  background: var(--panel-surface);
}

.panel-slider-hash-row {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.panel-slider-hash {
  position: absolute;
  top: 50%;
  height: 8px;
  width: 1px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: transparent;
  transition: background-color 200ms ease;
}
.panel-slider[data-panel-state="hover"] .panel-slider-hash,
.panel-slider[data-panel-state="drag"] .panel-slider-hash { background: var(--panel-hash); }

.panel-slider-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--panel-fill-pct, 0%);
  pointer-events: none;
  background: var(--panel-surface-idle-fill);
  transition: background-color 150ms ease, width 220ms cubic-bezier(0.2, 0, 0, 1);
}
.panel-slider[data-panel-state="drag"] .panel-slider-fill {
  transition: background-color 150ms ease, width 0ms;
  background: var(--panel-surface-active);
}
.panel-slider[data-panel-state="hover"] .panel-slider-fill { background: var(--panel-surface-active); }

.panel-slider-handle {
  position: absolute;
  top: 50%;
  height: 20px;
  width: 3px;
  left: var(--panel-handle-left, 0%);
  border-radius: 999px;
  pointer-events: none;
  background: var(--panel-handle);
  opacity: 0;
  transform: translate(-1.5px, -50%) scaleY(1);
  transform-origin: center center;
  transition:
    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    left 220ms cubic-bezier(0.2, 0, 0, 1);
}
.panel-slider[data-panel-state="hover"] .panel-slider-handle { opacity: 0.5; }
.panel-slider[data-panel-state="drag"] .panel-slider-handle {
  opacity: 0.9;
  transform: translate(-1.5px, -50%) scaleY(1.3);
  transition:
    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    left 0ms;
}

.panel-slider-label {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-slider-value {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
  transition: color 150ms ease;
}
.panel-slider[data-panel-state="hover"] .panel-slider-value,
.panel-slider[data-panel-state="drag"] .panel-slider-value { color: var(--panel-label-active); }

.panel-color {
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 8px;
  padding: 0 12px;
  background: var(--panel-surface);
}
.panel-color-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-color-right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-color-text {
  width: 7ch;
  background: transparent;
  border: 0;
  outline: 0;
  text-align: right;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
  text-transform: uppercase;
}
.panel-color-swatch {
  height: 20px;
  width: 20px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--panel-swatch-border);
  transition: transform 150ms ease;
}
.panel-color-swatch:hover { transform: scale(1.1); }
/* Sized + positioned over the swatch (not 0x0) so showPicker()/click() has a
   real anchor rect \u2014 pickers anchor to the input's position. */
.panel-color-native {
  position: absolute;
  right: 0;
  top: 50%;
  margin-top: -10px;
  height: 20px;
  width: 20px;
  opacity: 0;
  pointer-events: none;
}

.panel-path {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-path-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-path-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-path-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-path-count {
  font-size: 11px;
  color: var(--panel-muted-icon);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
[data-panel] .panel-path-clear {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  cursor: pointer;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-path-clear:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
.panel-path-pad {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel-surface);
  touch-action: none;
  cursor: crosshair;
  overflow: visible;
}
.panel-path-bg {
  fill: transparent;
  cursor: crosshair;
}
.panel-path-grid {
  stroke: var(--panel-divider);
  stroke-width: 0.5;
}
.panel-path-frame {
  fill: none;
  stroke: var(--panel-border);
  stroke-width: 0.5;
}
.panel-path-line {
  fill: none;
  stroke: var(--panel-handle);
  stroke-width: 1;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.55;
}
.panel-path-line-close {
  stroke: var(--panel-handle);
  stroke-width: 0.8;
  stroke-dasharray: 2 2;
  opacity: 0.3;
}
.panel-path-anchor circle {
  fill: none;
  stroke: var(--panel-handle);
  stroke-width: 1;
  opacity: 0.7;
}
.panel-path-anchor.is-draggable {
  cursor: grab;
}
.panel-path-anchor.is-draggable .panel-path-point-hit {
  cursor: grab;
}
.panel-path-anchor.is-draggable:active {
  cursor: grabbing;
}
.panel-path-anchor.is-selected circle:not(.panel-path-point-hit) {
  stroke-width: 1.4;
  opacity: 1;
}
.panel-path-anchor .panel-path-anchor-dot {
  fill: var(--panel-handle);
  stroke: none;
  opacity: 0.9;
}
.panel-path-point {
  cursor: grab;
}
.panel-path-point:active {
  cursor: grabbing;
}
.panel-path-point-hit {
  fill: transparent;
}
.panel-path-point-ring {
  fill: var(--panel-bg);
  stroke: var(--panel-handle);
  stroke-width: 1.2;
  transition: r 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-path-point.is-selected .panel-path-point-ring {
  fill: var(--panel-handle);
}
.panel-path-point-num {
  fill: var(--panel-label);
  font-size: 3.4px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
  pointer-events: none;
  user-select: none;
}
.panel-path-point.is-selected .panel-path-point-num {
  fill: var(--panel-bg);
}
.panel-path-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--panel-text-muted);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
[data-panel] .panel-path-remove {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  cursor: pointer;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-path-remove:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
.panel-path-hint {
  font-size: 10.5px;
  color: var(--panel-muted-icon);
  text-align: center;
}

.panel-image {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-image-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-image-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-image-upload {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.panel-image-upload:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
.panel-image-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel-surface);
  overflow: hidden;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.panel-image-frame[data-panel-interactive="true"] { cursor: pointer; }
.panel-image-frame[data-panel-interactive="true"]:hover,
.panel-image-frame[data-panel-drag="true"] {
  border-color: var(--panel-handle);
  background: var(--panel-surface-active);
}
.panel-image-preview {
  display: block;
  width: 75%;
  height: auto;
  border-radius: 4px;
}
.panel-image-empty {
  font-size: 11px;
  color: var(--panel-muted-icon);
  padding: 14px 0;
}
.panel-image-native {
  position: absolute;
  height: 0;
  width: 0;
  opacity: 0;
  pointer-events: none;
}

/* Scoped under [data-panel] so it beats the global button reset
   (which zeroes padding/background). The negative margin + matching padding
   full-bleeds the hover highlight ~8px past the label on each side, so the
   label stays aligned with the other rows but the highlight never touches its
   left edge. */
[data-panel] .panel-toggle {
  display: flex;
  height: 36px;
  width: calc(100% + 16px);
  margin: 0 -8px;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px;
  padding: 0 8px;
  background: transparent;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-toggle:hover { background: var(--panel-toggle-hover); }
.panel-toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-toggle-track {
  position: relative;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: var(--panel-surface-idle-fill);
  transition: background-color 200ms cubic-bezier(0.32, 0.72, 0, 1);
  flex-shrink: 0;
}
.panel-toggle[data-panel-on="true"] .panel-toggle-track {
  background: var(--panel-handle);
}
.panel-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--panel-bg);
  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
.panel-toggle[data-panel-on="false"] .panel-toggle-thumb {
  background: var(--panel-handle);
}
.panel-toggle[data-panel-on="true"] .panel-toggle-thumb {
  transform: translateX(12px);
}

/* Segmented single-select \u2014 optional label, then option buttons sharing a
   surface track. Selected uses the panel surface tokens, not a heavy fill. */
.panel-toggle-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 4px 0;
}
.panel-toggle-group-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
  line-height: 1.35;
  padding: 0 2px;
}
.panel-toggle-group-track {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--panel-surface);
}
[data-panel] .panel-toggle-group-btn {
  display: inline-flex;
  flex: 1 1 0;
  min-width: 0;
  height: 28px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  padding: 0 10px;
  color: var(--panel-text-muted);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-toggle-group-icon {
  display: inline-flex;
  flex-shrink: 0;
}
.panel-toggle-group-icon svg {
  width: 14px;
  height: 14px;
  display: block;
}
.panel-toggle-group-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
[data-panel] .panel-toggle-group-btn:hover {
  color: var(--panel-action-text-hover);
  background: var(--panel-toggle-hover);
}
[data-panel] .panel-toggle-group-btn:focus-visible {
  outline: 2px solid var(--panel-handle);
  outline-offset: -2px;
}
[data-panel] .panel-toggle-group-btn[data-panel-active="true"] {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-toggle-group-btn:active { transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) {
  [data-panel] .panel-toggle-group-btn { transition: none; }
  [data-panel] .panel-toggle-group-btn:active { transform: none; }
}

.panel-select {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: transparent;
}
.panel-select[data-panel-layout="inline"] {
  min-height: 36px;
  height: 36px;
  border-radius: 8px;
  padding: 0 12px;
  background: var(--panel-surface);
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-select[data-panel-layout="inline"]:hover {
  background: var(--panel-surface-active);
}
.panel-select[data-panel-layout="stacked"] {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-height: 0;
  height: auto;
  padding: 0;
  background: transparent;
}
.panel-select-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
  min-width: 0;
  line-height: 1.35;
}
.panel-select[data-panel-layout="stacked"] .panel-select-label {
  white-space: normal;
}
.panel-select[data-panel-layout="inline"] .panel-select-label {
  flex: 1 1 auto;
  white-space: normal;
}
[data-panel] .panel-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-shrink: 0;
  border: 0;
  outline: 0;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  line-height: normal;
  cursor: pointer;
  height: 36px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  overflow: visible;
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-select[data-panel-layout="stacked"] .panel-select-btn {
  align-self: stretch;
  width: 100%;
  max-width: none;
  justify-content: space-between;
}
.panel-select[data-panel-layout="inline"] .panel-select-btn {
  align-self: center;
  flex: 1 1 auto;
  max-width: none;
  height: 100%;
  justify-content: flex-end;
  padding: 0;
  background: transparent;
  border-radius: 0;
}
.panel-select[data-panel-layout="inline"] .panel-select-btn:hover,
.panel-select[data-panel-layout="inline"] .panel-select-btn:focus-visible {
  background: transparent;
}
/* Ellipsis horizontally only \u2014 vertical overflow clips descenders in custom fonts. */
.panel-select-value {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: visible;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.35;
}
[data-panel] .panel-select-btn:hover {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-select-btn:focus-visible {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
  outline: 2px solid var(--panel-handle);
  outline-offset: 1px;
}
[data-panel] .panel-select-btn:active { transform: none; }
.panel-select[data-panel-layout="stacked"] .panel-select-btn:active {
  transform: none;
}
.panel-select-chevron {
  width: 14px;
  height: 14px;
  opacity: 0.6;
  flex-shrink: 0;
}
.panel-select-layer {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}
.panel-select-menu {
  pointer-events: auto;
  overflow-y: auto;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.2);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  animation: panel-menu-in 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-select-menu[data-panel-up="true"] {
  animation-name: panel-menu-in-up;
}
@keyframes panel-menu-in {
  from {
    opacity: 0;
    transform: translate(-100%, 0) translateY(-4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translate(-100%, 0) translateY(0);
    filter: blur(0);
  }
}
@keyframes panel-menu-in-up {
  from {
    opacity: 0;
    transform: translate(-100%, -100%) translateY(4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translate(-100%, -100%) translateY(0);
    filter: blur(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .panel-select-menu { animation: none; }
}
[data-panel] .panel-select-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 0;
  background: transparent;
  color: var(--panel-label);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 120ms cubic-bezier(0.22, 1, 0.36, 1),
    color 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-select-option[data-panel-active="true"] {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-select-option[aria-selected="true"] {
  color: var(--panel-text);
}
.panel-select-check {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.9;
}

.panel-prompt {
  display: flex;
  flex-direction: column;
}
/* Bumped under [data-panel] so it ties the button reset on specificity
   and wins on source order \u2014 the reset sets padding: 0 globally. */
[data-panel] .panel-prompt-toggle {
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  transition: color 150ms ease;
}
[data-panel] .panel-prompt-toggle:hover,
.panel-prompt[data-panel-open="true"] .panel-prompt-toggle {
  color: var(--panel-label-active);
}
.panel-prompt-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.panel-prompt-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: transform 200ms ease;
}
.panel-prompt[data-panel-open="true"] .panel-prompt-caret { transform: rotate(180deg); }

.panel-prompt-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 2px;
}
.panel-prompt-desc {
  font-size: 11px;
  color: var(--panel-text-muted);
  line-height: 1.4;
  padding: 0 4px;
}
.panel-prompt-code-wrap {
  position: relative;
}
.panel-prompt-pre {
  margin: 0;
  padding: 10px 12px 22px;
  background: var(--panel-bg);
  color: var(--panel-text);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow-y: auto;
  scrollbar-width: thin;
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);
  mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);
}
.panel-prompt-pre::-webkit-scrollbar { width: 6px; }
.panel-prompt-pre::-webkit-scrollbar-thumb { background: var(--panel-surface-active); border-radius: 999px; }
/* Scoped under [data-panel] to beat the global button reset
   (background: transparent) on specificity \u2014 otherwise the button is
   transparent and the prompt text shows through behind the icon. The text
   field (--panel-bg) is ~95% opaque, so stack two copies \u2192 ~99.8% opaque, same hue. */
[data-panel] .panel-prompt-copy {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(var(--panel-bg), var(--panel-bg)),
    linear-gradient(var(--panel-bg), var(--panel-bg));
  color: var(--panel-label);
  border: 1px solid var(--panel-border);
  transition: color 150ms ease, transform 200ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
.panel-prompt-copy svg { width: 14px; height: 14px; }
[data-panel] .panel-prompt-copy:hover {
  /* Subtle surface tint over the opaque base. */
  background:
    linear-gradient(var(--panel-surface), var(--panel-surface)),
    linear-gradient(var(--panel-bg), var(--panel-bg)),
    linear-gradient(var(--panel-bg), var(--panel-bg));
  color: var(--panel-label-active);
  transform: scale(1.05);
}

.panel-vec2 {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-vec2-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
  padding: 0 12px;
}
.panel-vec2-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

/* \u2500\u2500 Preset selector \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-presets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px 2px;
}
.panel-presets-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
[data-panel] .panel-preset-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 36px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 0 28px 0 12px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  color: var(--panel-label);
  background:
    linear-gradient(45deg, transparent 50%, var(--panel-muted-icon) 50%),
    linear-gradient(135deg, var(--panel-muted-icon) 50%, transparent 50%),
    var(--panel-surface);
  background-position: calc(100% - 14px) 50%, calc(100% - 10px) 50%, 0 0;
  background-size: 4px 4px, 4px 4px, auto;
  background-repeat: no-repeat;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
}
[data-panel] .panel-preset-select:hover {
  color: var(--panel-label-active);
  background-color: var(--panel-surface-active);
}
[data-panel] .panel-preset-select:focus-visible {
  outline: 2px solid var(--panel-handle);
  outline-offset: 1px;
}

/* \u2500\u2500 ToolShell layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-tool-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.panel-tool-viewport {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.panel-tool-overlay {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 20;
  transition: opacity 500ms ease;
}
.panel-tool-overlay[data-panel-ui-visible="false"] {
  opacity: 0;
}
.panel-tool-topbar {
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  padding-bottom: 16px;
  transition: padding 300ms ease;
}
.panel-tool-topbar > * {
  pointer-events: auto;
}
.panel-tool-panels {
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.panel-panel-toggle {
  pointer-events: auto;
  position: absolute;
  bottom: 20px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--panel-text-muted);
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: left 300ms ease, right 300ms ease, background 150ms ease, color 150ms ease;
}
.panel-panel-toggle:hover {
  background: var(--panel-surface);
  color: var(--panel-text);
}
.panel-panel-toggle-icon {
  width: 16px;
  height: 16px;
  transition: transform 300ms ease;
}

/* \u2500\u2500 Canvas overlay projector (OFF-138) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* A single layer pinned over the canvas. Click-through by default so it never
   eats canvas pointer events; individual overlay items opt back in if needed.
   overflow: visible so items projected near the edges are not clipped. */
.panel-overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}
/* Each projected node. Positioned via transform only (translate \u2192 the screen
   point, then -50%/-50% to center). will-change hints the compositor; no
   layout-thrashing properties are ever written. */
.panel-overlay-item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.panel-eye-toggle {
  pointer-events: auto;
  position: absolute;
  bottom: 20px;
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--panel-text-muted);
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transform: translateX(-50%);
  transition: background 150ms ease, color 500ms ease, opacity 500ms ease;
}
.panel-eye-toggle[data-panel-visible="false"] {
  color: color-mix(in srgb, var(--panel-text-muted) 30%, transparent);
}
.panel-eye-toggle:hover {
  background: var(--panel-surface);
  color: var(--panel-text);
}
.panel-eye-toggle svg {
  width: 16px;
  height: 16px;
}

/* \u2500\u2500 Disclosure rows (POI / caption editors) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-disclosure {
  display: flex;
  flex-direction: column;
}
.panel-disclosure[data-panel-open="true"] {
  margin-bottom: 10px;
}
.panel-disclosure[data-panel-dimmed="true"] {
  opacity: 0.38;
  pointer-events: none;
}
.panel-disclosure[data-panel-highlight="true"] .panel-disclosure-toggle {
  box-shadow: inset 0 0 0 1px var(--panel-handle);
  color: var(--panel-label-active);
}
[data-panel] .panel-disclosure-toggle {
  display: flex;
  height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  transition: color 150ms ease, background-color 150ms ease;
}
[data-panel] .panel-disclosure-toggle:hover,
.panel-disclosure[data-panel-open="true"] .panel-disclosure-toggle {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
.panel-disclosure-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.panel-disclosure-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: transform 200ms ease;
}
.panel-disclosure[data-panel-open="true"] .panel-disclosure-caret {
  transform: rotate(180deg);
}
.panel-disclosure-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 14px;
}
/* Nested editors \u2014 damp hover scale so sliders don't spill past inset padding. */
[data-panel] .panel-disclosure-body .panel-slider,
[data-panel] .panel-vec2-row .panel-slider {
  width: 100%;
  margin: 0;
}
[data-panel] .panel-disclosure-body .panel-slider[data-panel-state="hover"],
[data-panel] .panel-vec2-row .panel-slider[data-panel-state="hover"] {
  transform: none;
}
[data-panel] .panel-disclosure-body .panel-slider[data-panel-state="drag"],
[data-panel] .panel-vec2-row .panel-slider[data-panel-state="drag"] {
  transform: scale(1.008);
}
[data-panel] .panel-disclosure-body .panel-toggle {
  width: 100%;
  margin: 0;
}

/* \u2500\u2500 Collection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-collection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-collection-header {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 8px;
}
.panel-collection-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-collection-count {
  display: inline-flex;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--panel-surface);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--panel-text-muted);
}
[data-panel] .panel-collection-add {
  margin-left: auto;
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  font-size: 12px;
  font-weight: 500;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-collection-add:hover:not(:disabled) {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-collection-add:active:not(:disabled) {
  transform: scale(0.98);
}
[data-panel] .panel-collection-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.panel-collection-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-collection-empty {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  font-size: 11px;
  color: var(--panel-text-muted);
}
.panel-collection-row {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  transition: opacity 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-collection-row[data-panel-dragging="true"] {
  opacity: 0.5;
}
.panel-collection-row[data-panel-dragover="true"] {
  box-shadow: inset 0 0 0 1px var(--panel-handle);
}
.panel-collection-row-head {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 4px;
  border-radius: 8px;
  background: var(--panel-surface);
  padding: 0 4px 0 6px;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-collection-row[data-panel-open="true"] .panel-collection-row-head {
  background: var(--panel-surface-active);
}
.panel-collection-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  cursor: grab;
}
.panel-collection-drag:active {
  cursor: grabbing;
}
.panel-collection-drag svg {
  width: 14px;
  height: 14px;
}
[data-panel] .panel-collection-row-toggle {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
  background: transparent;
  color: var(--panel-label);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-collection-row-toggle:hover,
.panel-collection-row[data-panel-open="true"] .panel-collection-row-toggle {
  color: var(--panel-label-active);
}
.panel-collection-row-label {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-collection-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-collection-row[data-panel-open="true"] .panel-collection-caret {
  transform: rotate(180deg);
}
[data-panel] .panel-collection-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--panel-muted-icon);
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-collection-remove:hover:not(:disabled) {
  color: var(--panel-danger);
  background: var(--panel-surface);
}
[data-panel] .panel-collection-remove:active:not(:disabled) {
  transform: scale(0.98);
}
[data-panel] .panel-collection-remove:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.panel-collection-remove svg {
  width: 13px;
  height: 13px;
}
.panel-collection-row-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px 12px;
}

/* \u2500\u2500 Reference \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-reference {
  display: flex;
  flex-direction: column;
}
[data-panel] .panel-reference-trigger {
  display: block;
  width: 100%;
  padding: 0;
  background: transparent;
  text-align: left;
  transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-reference-trigger:active {
  transform: scale(0.98);
}
[data-panel] .panel-reference-trigger .panel-readout {
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-reference-trigger:hover .panel-readout {
  background: var(--panel-surface-active);
}
.panel-reference-picker {
  padding-top: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .panel-collection-add,
  .panel-collection-remove,
  .panel-collection-caret,
  .panel-collection-row,
  .panel-collection-row-head,
  .panel-collection-row-toggle,
  .panel-reference-trigger,
  .panel-reference-trigger .panel-readout {
    transition: none;
  }
}

/* \u2500\u2500 Text input \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-text[data-panel-layout="inline"] {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-surface);
}
.panel-text-label,
.panel-search-label,
.panel-textarea-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
  padding: 0;
  line-height: 1.35;
}
.panel-text[data-panel-layout="inline"] .panel-text-label {
  padding: 0;
  flex-shrink: 0;
}
[data-panel] .panel-text-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  transition: background-color 150ms ease, color 150ms ease;
}
.panel-text[data-panel-layout="inline"] .panel-text-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  height: 100%;
  background: transparent;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-text[data-panel-layout="inline"] .panel-text-input:focus {
  background: transparent;
}
[data-panel] .panel-text-input[data-panel-mono="true"] {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
[data-panel] .panel-text-input:focus {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-text-input::placeholder {
  color: var(--panel-muted-icon);
  text-transform: none;
}

/* \u2500\u2500 Textarea \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-textarea {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-panel] .panel-textarea-input {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
  outline: none;
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-textarea-input:focus {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-textarea-input::placeholder {
  color: var(--panel-muted-icon);
}

.panel-search {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-search-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
[data-panel] .panel-search-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-search-input:focus {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-search-input::placeholder {
  color: var(--panel-muted-icon);
}
[data-panel] .panel-search-btn {
  flex-shrink: 0;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: background-color 150ms ease, color 150ms ease, transform 120ms ease;
}
[data-panel] .panel-search-btn:hover:not(:disabled) {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-search-btn:active:not(:disabled) {
  transform: scale(0.98);
}
[data-panel] .panel-search-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.panel-search-error {
  padding: 0 12px;
  font-size: 11px;
  line-height: 1.35;
  color: #ef4444;
}

/* \u2500\u2500 Readout row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-readout {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--panel-surface);
}
.panel-readout-label {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--panel-label);
}
.panel-readout-value {
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--panel-text-muted);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* \u2500\u2500 Option list (search results, pickers) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-option-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-option-list-title {
  padding: 0 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
}
.panel-option-list {
  display: flex;
  max-height: 168px;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  scrollbar-width: thin;
}
.panel-option-list::-webkit-scrollbar {
  width: 6px;
}
.panel-option-list::-webkit-scrollbar-thumb {
  background: var(--panel-surface-active);
  border-radius: 999px;
}
[data-panel] .panel-option-item {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  background: transparent;
  color: var(--panel-label);
  text-align: left;
  transition: background-color 120ms ease, color 120ms ease;
}
[data-panel] .panel-option-item:hover:not(:disabled) {
  background: var(--panel-surface);
  color: var(--panel-label-active);
}
[data-panel] .panel-option-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.panel-option-item-label {
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  color: inherit;
}
.panel-option-item-desc {
  width: 100%;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--panel-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.panel-option-empty {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--panel-surface);
  font-size: 11px;
  line-height: 1.35;
  color: var(--panel-text-muted);
}

/* \u2500\u2500 Hint copy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-hint {
  margin: 0;
  padding: 0 12px 2px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--panel-text-muted);
}
`;

// src/hooks/use-inject-styles.ts
var injectedCss = null;
function useInjectPanelStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (injectedCss === PANEL_CSS) return;
    let style = document.getElementById(PANEL_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = PANEL_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = PANEL_CSS;
    injectedCss = PANEL_CSS;
  }, []);
}
function FloatingPanel({
  side,
  collapsed,
  onToggle,
  onOpen,
  title,
  titleSlot,
  children,
  className,
  defaultTheme,
  themeStorageKey,
  showThemeToggle = true,
  container: container2,
  inline = false,
  peek = true
}) {
  const open = onOpen ?? onToggle;
  useInjectPanelStyles();
  const theme = usePanelTheme(defaultTheme);
  const [mounted, setMounted] = useState(false);
  const showPeek = peek && !inline;
  const [hoverSensor, setHoverSensor] = useState(false);
  const [hoverPanel, setHoverPanel] = useState(false);
  const peeking = showPeek && collapsed && (hoverSensor || hoverPanel);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!collapsed) {
      setHoverSensor(false);
      setHoverPanel(false);
    }
  }, [collapsed]);
  if (!mounted) return null;
  const panel = /* @__PURE__ */ jsxs(PanelThemeProvider, { value: theme, children: [
    showPeek && collapsed ? /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-edge-sensor",
        "data-panel-side": side,
        "data-panel-inline": inline ? "true" : "false",
        onMouseEnter: () => setHoverSensor(true),
        onMouseLeave: () => setHoverSensor(false),
        onClick: open,
        "aria-hidden": "true"
      }
    ) : null,
    /* @__PURE__ */ jsxs(
      "div",
      {
        "data-panel": "",
        "data-panel-theme": theme,
        "data-panel-side": side,
        "data-panel-collapsed": collapsed ? "true" : "false",
        "data-panel-peek": peeking ? "true" : "false",
        "data-panel-inline": inline ? "true" : "false",
        className: cn("panel-floating", className),
        onMouseEnter: () => setHoverPanel(true),
        onMouseLeave: () => setHoverPanel(false),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "panel-panel", children: [
            /* @__PURE__ */ jsxs("div", { className: "panel-panel-header", children: [
              /* @__PURE__ */ jsxs("div", { className: "panel-panel-title-row", children: [
                /* @__PURE__ */ jsx("span", { className: "panel-panel-title", children: title }),
                titleSlot
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "panel-panel-header-end", children: [
                showThemeToggle ? /* @__PURE__ */ jsx(ControlThemeToggle, { storageKey: themeStorageKey }) : null,
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: onToggle,
                    "aria-label": "Close panel",
                    className: "panel-close-btn",
                    children: /* @__PURE__ */ jsx(CloseIcon, {})
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "panel-panel-body", children })
          ] }),
          peeking ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-peek-catch",
              onClick: open,
              "aria-label": "Open panel"
            }
          ) : null
        ]
      }
    )
  ] });
  if (inline) return panel;
  const target = container2 ?? (typeof document !== "undefined" ? document.body : null);
  if (!target) return null;
  return createPortal(panel, target);
}
function CloseIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M6 6l12 12M18 6L6 18" })
    }
  );
}

// src/hooks/animation-clock.ts
var PANEL_ANIMATION_STEP = 1 / 30;
var playing = true;
var time = 0;
var rate = 1;
var revision = 0;
var rafId = 0;
var lastRafAt = 0;
var cachedRevision = -1;
var cachedSnapshot = {
  playing: true,
  time: 0,
  rate: 1
};
var listeners = /* @__PURE__ */ new Set();
function notify() {
  revision += 1;
  for (const listener of listeners) listener();
}
function tick(now) {
  if (!playing) return;
  const dt = (now - lastRafAt) / 1e3;
  lastRafAt = now;
  if (dt > 0 && dt < 0.5) {
    time += dt * rate;
    notify();
  }
  rafId = requestAnimationFrame(tick);
}
function ensureLoop() {
  if (typeof requestAnimationFrame === "undefined") return;
  if (rafId !== 0) return;
  lastRafAt = performance.now();
  rafId = requestAnimationFrame(tick);
}
function stopLoop() {
  if (rafId !== 0) cancelAnimationFrame(rafId);
  rafId = 0;
}
function playPanelAnimation() {
  if (playing) return;
  playing = true;
  lastRafAt = performance.now();
  notify();
  ensureLoop();
}
function pausePanelAnimation() {
  if (!playing) return;
  playing = false;
  stopLoop();
  notify();
}
function togglePanelAnimation() {
  if (playing) pausePanelAnimation();
  else playPanelAnimation();
}
function stepPanelAnimationForward(step = PANEL_ANIMATION_STEP) {
  time += step;
  notify();
}
function stepPanelAnimationBackward(step = PANEL_ANIMATION_STEP) {
  time = Math.max(0, time - step);
  notify();
}
function resetPanelAnimation() {
  time = 0;
  notify();
}
function setPanelAnimationTime(next) {
  time = Math.max(0, next);
  notify();
}
function setPanelAnimationRate(next) {
  rate = Math.max(0.01, Math.min(8, next));
  notify();
}
function getPanelAnimationSnapshot() {
  if (revision !== cachedRevision) {
    cachedRevision = revision;
    cachedSnapshot = { playing, time, rate };
  }
  return cachedSnapshot;
}
function getPanelAnimationTime() {
  return time;
}
function getPanelAnimationRevision() {
  return revision;
}
function subscribePanelAnimation(listener) {
  listeners.add(listener);
  if (playing) ensureLoop();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopLoop();
  };
}
function advancePanelAnimationDelta(previousTime) {
  const nextTime = getPanelAnimationTime();
  const delta = Math.max(-0.1, Math.min(nextTime - previousTime, 0.1));
  return { time: nextTime, delta };
}
function initPanelAnimationClock() {
  if (playing) ensureLoop();
}
function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 1e3);
  return `${whole}.${frac.toString().padStart(3, "0")}s`;
}
function ControlAnimation({
  className,
  step = PANEL_ANIMATION_STEP
}) {
  useEffect(() => {
    initPanelAnimationClock();
  }, []);
  useSyncExternalStore(
    subscribePanelAnimation,
    getPanelAnimationRevision,
    () => 0
  );
  const snapshot = getPanelAnimationSnapshot();
  const togglePlay = useCallback(() => {
    if (snapshot.playing) pausePanelAnimation();
    else playPanelAnimation();
  }, [snapshot.playing]);
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-animation", className), children: [
    /* @__PURE__ */ jsx("div", { className: "panel-animation-label", children: "Animation" }),
    /* @__PURE__ */ jsxs("div", { className: "panel-animation-row", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn",
          onClick: () => stepPanelAnimationBackward(step),
          "aria-label": "Step backward one frame",
          title: "Step back",
          children: /* @__PURE__ */ jsx(StepBackIcon, {})
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn panel-animation-btn-primary",
          onClick: togglePlay,
          "aria-label": snapshot.playing ? "Pause animation" : "Play animation",
          title: snapshot.playing ? "Pause" : "Play",
          children: snapshot.playing ? /* @__PURE__ */ jsx(PauseIcon, {}) : /* @__PURE__ */ jsx(PlayIcon, {})
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn",
          onClick: () => stepPanelAnimationForward(step),
          "aria-label": "Step forward one frame",
          title: "Step forward",
          children: /* @__PURE__ */ jsx(StepForwardIcon, {})
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "panel-animation-time", "aria-live": "polite", children: formatTime(snapshot.time) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn panel-animation-btn-reset",
          onClick: resetPanelAnimation,
          "aria-label": "Reset animation time",
          title: "Reset to 0",
          children: /* @__PURE__ */ jsx(ResetIcon, {})
        }
      )
    ] })
  ] });
}
function PlayIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M5 4.98951C5 4.01835 5 3.53277 5.20249 3.2651C5.37889 3.03191 5.64852 2.88761 5.9404 2.87018C6.27544 2.85017 6.67946 3.11953 7.48752 3.65823L18.0031 10.6686C18.6708 11.1137 19.0046 11.3363 19.1209 11.6168C19.2227 11.8621 19.2227 12.1377 19.1209 12.383C19.0046 12.6635 18.6708 12.886 18.0031 13.3312L7.48752 20.3415C6.67946 20.8802 6.27544 21.1496 5.9404 21.1296C5.64852 21.1122 5.37889 20.9679 5.20249 20.7347C5 20.467 5 19.9814 5 19.0103V4.98951Z" })
    }
  );
}
function PauseIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M8 5v14" }),
        /* @__PURE__ */ jsx("path", { d: "M16 5v14" })
      ]
    }
  );
}
function StepBackIcon() {
  return /* @__PURE__ */ jsx(SkipIcon, { direction: "back" });
}
function StepForwardIcon() {
  return /* @__PURE__ */ jsx(SkipIcon, { direction: "forward" });
}
function SkipIcon({ direction }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      style: direction === "back" ? { transform: "scaleX(-1)" } : void 0,
      children: [
        /* @__PURE__ */ jsx("path", { d: "M13 16.437C13 17.567 13 18.1321 13.2283 18.4091C13.4266 18.6497 13.7258 18.7841 14.0374 18.7724C14.3961 18.759 14.8184 18.3836 15.663 17.6329L20.6547 13.1958C21.12 12.7822 21.3526 12.5754 21.4383 12.3312C21.5136 12.1168 21.5136 11.8831 21.4383 11.6687C21.3526 11.4245 21.12 11.2177 20.6547 10.8041L15.663 6.36706C14.8184 5.61631 14.3961 5.24093 14.0374 5.22751C13.7258 5.21584 13.4266 5.35021 13.2283 5.59086C13 5.86787 13 6.43288 13 7.56291V16.437Z" }),
        /* @__PURE__ */ jsx("path", { d: "M2 16.437C2 17.567 2 18.1321 2.22827 18.4091C2.42657 18.6497 2.72579 18.7841 3.0374 18.7724C3.39609 18.759 3.81839 18.3836 4.66298 17.6329L9.65466 13.1958C10.12 12.7822 10.3526 12.5754 10.4383 12.3312C10.5136 12.1168 10.5136 11.8831 10.4383 11.6687C10.3526 11.4245 10.12 11.2177 9.65466 10.8041L4.66298 6.36706C3.81839 5.61631 3.39609 5.24093 3.0374 5.22751C2.72579 5.21584 2.42657 5.35021 2.22827 5.59086C2 5.86787 2 6.43288 2 7.56291V16.437Z" })
      ]
    }
  );
}
function ResetIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M13 22L10 19M10 19L13 16M10 19H15C18.866 19 22 15.866 22 12C22 9.2076 20.3649 6.7971 18 5.67363M6 18.3264C3.63505 17.2029 2 14.7924 2 12C2 8.13401 5.13401 5 9 5H14M14 5L11 2M14 5L11 8" })
    }
  );
}

// src/lib/png-dpi.ts
var PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
var crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}
function crc32(bytes) {
  const table = getCrcTable();
  let crc = 4294967295;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  }
  return (crc ^ 4294967295) >>> 0;
}
function readChunkType(data, offset) {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3]
  );
}
function isPng(data) {
  if (data.length < PNG_SIGNATURE.length) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (data[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}
function createPhysChunk(dpi) {
  const ppm = Math.max(1, Math.round(dpi / 0.0254));
  const chunkData = new Uint8Array(9);
  const view = new DataView(chunkData.buffer);
  view.setUint32(0, ppm, false);
  view.setUint32(4, ppm, false);
  chunkData[8] = 1;
  const type = new TextEncoder().encode("pHYs");
  const crcInput = new Uint8Array(type.length + chunkData.length);
  crcInput.set(type, 0);
  crcInput.set(chunkData, type.length);
  const out = new Uint8Array(4 + 4 + chunkData.length + 4);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, chunkData.length, false);
  out.set(type, 4);
  out.set(chunkData, 8);
  outView.setUint32(8 + chunkData.length, crc32(crcInput), false);
  return out;
}
async function embedPngDpi(blob, dpi) {
  if (!Number.isFinite(dpi) || dpi <= 0) return blob;
  const input = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(input)) return blob;
  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  let inserted = false;
  while (offset + 8 <= input.length) {
    const view = new DataView(input.buffer, input.byteOffset + offset);
    const length = view.getUint32(0, false);
    const type = readChunkType(input, offset + 4);
    const total = 12 + length;
    if (offset + total > input.length) break;
    const chunk = input.slice(offset, offset + total);
    if (type === "pHYs") {
      offset += total;
      continue;
    }
    chunks.push(chunk);
    if (!inserted && type === "IHDR") {
      chunks.push(createPhysChunk(dpi));
      inserted = true;
    }
    offset += total;
  }
  if (!inserted) return blob;
  const out = new Uint8Array(
    PNG_SIGNATURE.length + chunks.reduce((sum, c) => sum + c.length, 0)
  );
  out.set(PNG_SIGNATURE, 0);
  let write = PNG_SIGNATURE.length;
  for (const chunk of chunks) {
    out.set(chunk, write);
    write += chunk.length;
  }
  return new Blob([out], { type: "image/png" });
}
function printMaxEdgePx(widthInches, heightInches, dpi) {
  return Math.max(
    Math.round(widthInches * dpi),
    Math.round(heightInches * dpi)
  );
}

// src/hooks/capture-registry.ts
var current = null;
var gifExport = null;
var videoExport = null;
var recordCanvasGetter = null;
var recordPrepare = null;
var recordFrame = null;
var recording = false;
var recordingContinuous = false;
var captureListeners = /* @__PURE__ */ new Set();
var recordingListeners = /* @__PURE__ */ new Set();
function notifyCaptureListeners() {
  for (const listener of captureListeners) listener();
}
function notifyRecordingListeners(next) {
  recording = next;
  if (!next) recordingContinuous = false;
  const opts = { continuous: recordingContinuous };
  for (const listener of recordingListeners) listener(next, opts);
}
function registerShaderCapture(fn) {
  current = fn;
  notifyCaptureListeners();
  return () => {
    if (current === fn) {
      current = null;
      notifyCaptureListeners();
    }
  };
}
function getShaderCapture() {
  return current;
}
function subscribeShaderCapture(listener) {
  captureListeners.add(listener);
  return () => captureListeners.delete(listener);
}
function registerShaderRecordCanvas(getter) {
  recordCanvasGetter = getter;
  return () => {
    if (recordCanvasGetter === getter) recordCanvasGetter = null;
  };
}
function getShaderRecordCanvas() {
  return recordCanvasGetter?.() ?? null;
}
function registerShaderRecordPrepare(fn) {
  recordPrepare = fn;
  return () => {
    if (recordPrepare === fn) recordPrepare = null;
  };
}
function getShaderRecordPrepare() {
  return recordPrepare;
}
function registerShaderGifExport(fn) {
  gifExport = fn;
  return () => {
    if (gifExport === fn) gifExport = null;
  };
}
function getShaderGifExport() {
  return gifExport;
}
function registerShaderVideoExport(fn) {
  videoExport = fn;
  return () => {
    if (videoExport === fn) videoExport = null;
  };
}
function getShaderVideoExport() {
  return videoExport;
}
function registerShaderRecordFrame(fn) {
  recordFrame = fn;
  return () => {
    if (recordFrame === fn) recordFrame = null;
  };
}
function getShaderRecordFrame() {
  return recordFrame;
}
function subscribeShaderRecording(listener) {
  recordingListeners.add(listener);
  listener(recording, { continuous: recordingContinuous });
  return () => recordingListeners.delete(listener);
}
function setShaderRecording(active, opts) {
  const nextContinuous = active ? !!opts?.continuous : false;
  if (recording === active && recordingContinuous === nextContinuous) return;
  recordingContinuous = nextContinuous;
  notifyRecordingListeners(active);
}

// src/lib/webcodecs-mp4-recorder.ts
var TARGET_FPS = 60;
var FRAME_DURATION = 1 / TARGET_FPS;
function evenDimension(n) {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}
function bitrateForCanvas(width, height) {
  const megapixels = width * height / 1e6;
  return Math.round(
    Math.min(8e7, Math.max(24e6, megapixels * 12e6))
  );
}
async function canRecordWebCodecsMp4(width, height) {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    return await canEncodeVideo("avc", {
      width: evenDimension(width),
      height: evenDimension(height)
    });
  } catch {
    return false;
  }
}
async function startWebCodecsMp4Recording(canvas) {
  const width = evenDimension(canvas.width);
  const height = evenDimension(canvas.height);
  if (width < 2 || height < 2) {
    throw new Error("Canvas has no dimensions yet");
  }
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target
  });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: bitrateForCanvas(width, height),
    latencyMode: "realtime",
    keyFrameInterval: 1,
    sizeChangeBehavior: "passThrough"
  });
  output.addVideoTrack(videoSource);
  await output.start();
  let lastTimestamp = -FRAME_DURATION;
  let frameCount = 0;
  let capturing = true;
  let aborted = false;
  let rafId2 = 0;
  let loopPromise = Promise.resolve();
  const startedAt = performance.now();
  const paintHostFrame = async () => {
    const paint = getShaderRecordFrame();
    if (!paint) return;
    await paint();
  };
  const captureOne = async () => {
    if (aborted || !capturing) return;
    await paintHostFrame();
    if (aborted || !capturing) return;
    const timestamp = Math.max(
      lastTimestamp + FRAME_DURATION * 0.5,
      (performance.now() - startedAt) / 1e3
    );
    const duration = Math.max(FRAME_DURATION * 0.5, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    frameCount += 1;
    try {
      await videoSource.add(timestamp, duration);
    } catch {
    }
  };
  const pump = () => {
    if (!capturing || aborted) return;
    loopPromise = captureOne().finally(() => {
      if (!capturing || aborted) return;
      rafId2 = requestAnimationFrame(pump);
    });
  };
  rafId2 = requestAnimationFrame(pump);
  return {
    stop: async () => {
      if (aborted) return new Blob([], { type: "video/mp4" });
      capturing = false;
      cancelAnimationFrame(rafId2);
      await loopPromise;
      const endTimestamp = Math.max(
        lastTimestamp + FRAME_DURATION,
        (performance.now() - startedAt) / 1e3
      );
      if (frameCount === 0) {
        await paintHostFrame();
        await videoSource.add(0, Math.max(FRAME_DURATION, endTimestamp));
      } else if (endTimestamp > lastTimestamp + FRAME_DURATION * 0.25) {
        try {
          await paintHostFrame();
          await videoSource.add(
            endTimestamp,
            Math.max(FRAME_DURATION, endTimestamp - lastTimestamp)
          );
        } catch {
        }
      }
      await output.finalize();
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error("Recording was empty");
      }
      return new Blob([buffer], { type: "video/mp4" });
    },
    abort: async () => {
      aborted = true;
      capturing = false;
      cancelAnimationFrame(rafId2);
      try {
        await output.cancel();
      } catch {
      }
    }
  };
}
var EXPORT_DPI = 300;
var GIF_DURATION_OPTIONS = [2, 3, 5, 8];
var GIF_FPS_OPTIONS = [10, 12, 15];
var GIF_DEFAULT_DURATION_SEC = 3;
var GIF_DEFAULT_FPS = 12;
var GIF_RES_PRESETS = [
  { label: "720", maxEdge: 720 },
  { label: "1080", maxEdge: 1080 },
  { label: "1440", maxEdge: 1440 }
];
var GIF_DEFAULT_RES_INDEX = 0;
var SCREEN_RES_PRESETS = [
  { label: "4K", maxEdge: 3840 },
  { label: "8K", maxEdge: 7680 },
  { label: "16K", maxEdge: 15360 }
];
var PRINT_RES_PRESETS = [
  {
    label: "8\u2033",
    maxEdge: printMaxEdgePx(8, 4.5, EXPORT_DPI),
    printHint: `8\u2033 @ ${EXPORT_DPI}dpi`
  },
  {
    label: "11\u2033",
    maxEdge: printMaxEdgePx(11, 8.5, EXPORT_DPI),
    printHint: `11\u2033 @ ${EXPORT_DPI}dpi`
  },
  {
    label: "16\u2033",
    maxEdge: printMaxEdgePx(16, 9, EXPORT_DPI),
    printHint: `16\u2033 @ ${EXPORT_DPI}dpi`
  },
  {
    label: "24\u2033",
    maxEdge: printMaxEdgePx(24, 13.5, EXPORT_DPI),
    printHint: `24\u2033 @ ${EXPORT_DPI}dpi`
  }
];
var RES_PRESETS = [
  ...SCREEN_RES_PRESETS,
  ...PRINT_RES_PRESETS
];
async function withExportDpi(blob) {
  return embedPngDpi(blob, EXPORT_DPI);
}
function findShaderCanvas() {
  let best = null;
  let bestArea = 0;
  for (const c of Array.from(document.querySelectorAll("canvas"))) {
    const area = c.width * c.height;
    if (area > bestArea) {
      best = c;
      bestArea = area;
    }
  }
  return best;
}
async function canvasToPngBlob(canvas) {
  const w = window;
  try {
    if (typeof canvas.captureStream === "function" && w.ImageCapture) {
      const stream = canvas.captureStream();
      const track = stream.getVideoTracks()[0];
      if (track) {
        const cap = new w.ImageCapture(track);
        const bitmap = await cap.grabFrame();
        track.stop();
        const off = document.createElement("canvas");
        off.width = bitmap.width;
        off.height = bitmap.height;
        off.getContext("2d")?.drawImage(bitmap, 0, 0);
        const blob2 = await new Promise(
          (res) => off.toBlob(res, "image/png")
        );
        if (blob2 && blob2.size > 0) return blob2;
      }
    }
  } catch {
  }
  const blob = await new Promise(
    (res) => canvas.toBlob(res, "image/png")
  );
  if (!blob) throw new Error("Could not read the canvas");
  return blob;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4e3);
}
function pickMediaRecorderFormat() {
  const candidates = [
    "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        return { mimeType: c, ext: c.startsWith("video/mp4") ? "mp4" : "webm" };
      }
    }
  }
  return { mimeType: "video/mp4", ext: "mp4" };
}
function videoBitrateForCanvas(canvas) {
  const megapixels = canvas.width * canvas.height / 1e6;
  return Math.round(
    Math.min(8e7, Math.max(24e6, megapixels * 12e6))
  );
}
function fileBase(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "shader";
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${slug}-${stamp}`;
}
function extensionForVideoBlob(blob) {
  const type = blob.type.toLowerCase();
  if (type.includes("quicktime") || type.includes("mov")) return "mov";
  if (type.includes("webm")) return "webm";
  return "mp4";
}
function presetExportLabel(preset) {
  return preset.printHint ?? preset.label;
}
async function waitForCompositeReady() {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick2 = () => {
      const canvas = getShaderRecordCanvas() ?? findShaderCanvas();
      if (canvas && (getShaderRecordCanvas() || canvas.width > 2)) {
        requestAnimationFrame(
          () => requestAnimationFrame(() => resolve(canvas))
        );
        return;
      }
      if (performance.now() - started > 5e3) {
        resolve(canvas);
        return;
      }
      requestAnimationFrame(tick2);
    };
    requestAnimationFrame(tick2);
  });
}
function ControlExport({ name = "shader" }) {
  const [status, setStatus] = useState(null);
  const [recording2, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resIndex, setResIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gifBusy, setGifBusy] = useState(false);
  const [gifDurationSec, setGifDurationSec] = useState(
    GIF_DEFAULT_DURATION_SEC
  );
  const [gifFps, setGifFps] = useState(GIF_DEFAULT_FPS);
  const [gifResIndex, setGifResIndex] = useState(GIF_DEFAULT_RES_INDEX);
  const mediaRecorderRef = useRef(null);
  const webCodecsRef = useRef(null);
  const hostVideoRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stoppingRef = useRef(false);
  const flash = useCallback((msg, ms = 2400) => {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => s === msg ? null : s), ms);
  }, []);
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const finishUi = useCallback(() => {
    setShaderRecording(false, { continuous: false });
    clearTimer();
    setRecording(false);
    setElapsed(0);
    stoppingRef.current = false;
  }, [clearTimer]);
  const copyImage = useCallback(async () => {
    setBusy(true);
    try {
      const preset = RES_PRESETS[resIndex];
      const exportLabel = presetExportLabel(preset);
      const capture = getShaderCapture();
      if (capture) {
        flash(`Rendering ${exportLabel}\u2026`, 3e4);
        const blob2 = await withExportDpi(
          await capture({ maxEdge: preset.maxEdge })
        );
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob2 })
          ]);
          flash(`Image copied (${exportLabel}, ${EXPORT_DPI} DPI)`);
        } catch {
          downloadBlob(
            blob2,
            `${fileBase(name)}-${preset.label.replace(/″/g, "in")}-${EXPORT_DPI}dpi.png`
          );
          flash(`Clipboard blocked \u2014 downloaded PNG (${exportLabel})`);
        }
        return;
      }
      const canvas = findShaderCanvas();
      if (!canvas) return flash("No shader canvas found");
      const blob = await withExportDpi(await canvasToPngBlob(canvas));
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        flash(`Image copied (${EXPORT_DPI} DPI)`);
      } catch {
        downloadBlob(blob, `${fileBase(name)}-${EXPORT_DPI}dpi.png`);
        flash("Clipboard blocked \u2014 downloaded PNG");
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "Image export failed");
    } finally {
      setBusy(false);
    }
  }, [flash, name, resIndex]);
  const saveImage = useCallback(async () => {
    setBusy(true);
    try {
      const preset = RES_PRESETS[resIndex];
      const exportLabel = presetExportLabel(preset);
      const capture = getShaderCapture();
      if (capture) {
        flash(`Rendering ${exportLabel}\u2026`, 3e4);
        const blob2 = await withExportDpi(
          await capture({ maxEdge: preset.maxEdge })
        );
        downloadBlob(
          blob2,
          `${fileBase(name)}-${preset.label.replace(/″/g, "in")}-${EXPORT_DPI}dpi.png`
        );
        flash(`PNG saved (${exportLabel}, ${EXPORT_DPI} DPI)`);
        return;
      }
      const canvas = findShaderCanvas();
      if (!canvas) return flash("No shader canvas found");
      const blob = await withExportDpi(await canvasToPngBlob(canvas));
      downloadBlob(blob, `${fileBase(name)}-${EXPORT_DPI}dpi.png`);
      flash(`PNG downloaded (${EXPORT_DPI} DPI)`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Image export failed");
    } finally {
      setBusy(false);
    }
  }, [flash, name, resIndex]);
  const startMediaRecorderFallback = useCallback(
    (canvas) => {
      if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
        flash("Recording not supported here");
        setShaderRecording(false, { continuous: false });
        return;
      }
      setShaderRecording(true, { continuous: true });
      const stream = canvas.captureStream(60);
      streamRef.current = stream;
      const { mimeType, ext } = pickMediaRecorderFormat();
      const videoBitsPerSecond = videoBitrateForCanvas(canvas);
      let rec;
      try {
        rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
      } catch {
        try {
          rec = new MediaRecorder(stream, { videoBitsPerSecond });
        } catch {
          rec = new MediaRecorder(stream);
        }
      }
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        finishUi();
        if (blob.size > 0) {
          downloadBlob(blob, `${fileBase(name)}.${ext}`);
          flash(`Video saved (.${ext})`);
        } else {
          flash("Recording was empty");
        }
      };
      mediaRecorderRef.current = rec;
      rec.start(1e3);
      setRecording(true);
      const startedAt = performance.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1e3);
      }, 100);
    },
    [finishUi, flash, name]
  );
  const stopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const host = hostVideoRef.current;
    if (host) {
      hostVideoRef.current = null;
      clearTimer();
      setRecording(false);
      flash("Encoding video\u2026", 6e4);
      try {
        const blob = await host.stop();
        finishUi();
        if (blob.size > 0) {
          const ext = extensionForVideoBlob(blob);
          downloadBlob(blob, `${fileBase(name)}.${ext}`);
          flash(`Video saved (.${ext})`);
        } else {
          flash("Recording was empty");
        }
      } catch (e) {
        finishUi();
        flash(e instanceof Error ? e.message : "Video encode failed");
      }
      return;
    }
    const web = webCodecsRef.current;
    if (web) {
      webCodecsRef.current = null;
      setShaderRecording(false, { continuous: false });
      clearTimer();
      setRecording(false);
      flash("Encoding MP4\u2026", 6e4);
      try {
        const blob = await web.stop();
        finishUi();
        if (blob.size > 0) {
          downloadBlob(blob, `${fileBase(name)}.mp4`);
          flash("Video saved (.mp4)");
        } else {
          flash("Recording was empty");
        }
      } catch (e) {
        finishUi();
        flash(e instanceof Error ? e.message : "MP4 encode failed");
      }
      return;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      return;
    }
    finishUi();
  }, [clearTimer, finishUi, flash, name]);
  const startRecording = useCallback(async () => {
    const hostVideo = getShaderVideoExport();
    if (hostVideo) {
      try {
        hostVideoRef.current = await hostVideo();
        setRecording(true);
        const startedAt = performance.now();
        setElapsed(0);
        timerRef.current = window.setInterval(() => {
          setElapsed((performance.now() - startedAt) / 1e3);
        }, 100);
        return;
      } catch (e) {
        hostVideoRef.current = null;
        return flash(
          e instanceof Error ? e.message : "Video recording failed to start"
        );
      }
    }
    const prepare = getShaderRecordPrepare();
    if (prepare) {
      try {
        await prepare();
      } catch (e) {
        return flash(e instanceof Error ? e.message : "Recording prep failed");
      }
    }
    setShaderRecording(true, { continuous: false });
    const canvas = await waitForCompositeReady();
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      setShaderRecording(false, { continuous: false });
      return flash("No shader canvas found");
    }
    const paint = getShaderRecordFrame();
    if (paint) await paint();
    const useWebCodecs = await canRecordWebCodecsMp4(
      canvas.width,
      canvas.height
    );
    if (useWebCodecs) {
      try {
        webCodecsRef.current = await startWebCodecsMp4Recording(canvas);
        setRecording(true);
        const startedAt = performance.now();
        setElapsed(0);
        timerRef.current = window.setInterval(() => {
          setElapsed((performance.now() - startedAt) / 1e3);
        }, 100);
        return;
      } catch (e) {
        webCodecsRef.current = null;
        flash(
          e instanceof Error ? `WebCodecs failed \u2014 falling back (${e.message})` : "WebCodecs failed \u2014 falling back",
          3200
        );
      }
    }
    startMediaRecorderFallback(canvas);
  }, [flash, startMediaRecorderFallback]);
  const exportGif = useCallback(async () => {
    const gifExport2 = getShaderGifExport();
    if (!gifExport2) {
      return flash("GIF export not available");
    }
    const preset = GIF_RES_PRESETS[gifResIndex] ?? GIF_RES_PRESETS[0];
    setGifBusy(true);
    const frames = Math.round(gifDurationSec * gifFps);
    flash(
      `Rendering GIF (${preset.label}p \xB7 ${frames} frames)\u2026`,
      12e4
    );
    try {
      const blob = await gifExport2({
        durationSec: gifDurationSec,
        fps: gifFps,
        maxEdge: preset.maxEdge,
        onProgress: (progress) => {
          flash(
            `Rendering GIF (${preset.label}p)\u2026 ${Math.round(progress * 100)}%`,
            12e4
          );
        }
      });
      downloadBlob(blob, `${fileBase(name)}-${preset.label}p.gif`);
      flash(`GIF saved (${preset.label}p)`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "GIF export failed");
    } finally {
      setGifBusy(false);
    }
  }, [flash, gifDurationSec, gifFps, gifResIndex, name]);
  useEffect(() => {
    return () => {
      const host = hostVideoRef.current;
      if (host) {
        hostVideoRef.current = null;
        void host.stop().catch(() => {
        });
      }
      const web = webCodecsRef.current;
      if (web) {
        webCodecsRef.current = null;
        void web.abort();
      }
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [clearTimer]);
  const controlsLocked = busy || gifBusy || recording2;
  return /* @__PURE__ */ jsxs("div", { className: "panel-export", children: [
    /* @__PURE__ */ jsx("div", { className: "panel-export-label", children: "Export" }),
    /* @__PURE__ */ jsxs("div", { className: "panel-export-row", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-action-btn",
          onClick: copyImage,
          disabled: controlsLocked,
          children: "Copy image"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-action-btn",
          onClick: saveImage,
          disabled: controlsLocked,
          children: busy ? "Rendering\u2026" : "Save PNG"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "panel-export-res-group",
        role: "group",
        "aria-label": "PNG resolution",
        children: [
          /* @__PURE__ */ jsx("div", { className: "panel-export-res panel-export-res-screen", children: SCREEN_RES_PRESETS.map((preset, i) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cn(
                "panel-export-res-btn",
                i === resIndex && "panel-export-res-active"
              ),
              "aria-pressed": i === resIndex,
              title: `${preset.maxEdge}px longest edge \xB7 ${EXPORT_DPI} DPI metadata`,
              onClick: () => setResIndex(i),
              disabled: controlsLocked,
              children: preset.label
            },
            preset.label
          )) }),
          /* @__PURE__ */ jsx("div", { className: "panel-export-res panel-export-res-print", children: PRINT_RES_PRESETS.map((preset, i) => {
            const index = SCREEN_RES_PRESETS.length + i;
            return /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: cn(
                  "panel-export-res-btn",
                  index === resIndex && "panel-export-res-active"
                ),
                "aria-pressed": index === resIndex,
                title: preset.printHint ?? `${preset.maxEdge}px longest edge \xB7 ${EXPORT_DPI} DPI metadata`,
                onClick: () => setResIndex(index),
                disabled: controlsLocked,
                children: preset.label
              },
              preset.label
            );
          }) })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: cn("panel-action-btn", recording2 && "panel-export-rec"),
        onClick: recording2 ? () => void stopRecording() : () => void startRecording(),
        disabled: gifBusy || busy,
        children: recording2 ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "panel-export-dot" }),
          " Stop recording \xB7",
          " ",
          elapsed.toFixed(1),
          "s"
        ] }) : "Record video"
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "panel-export-gif", children: [
      /* @__PURE__ */ jsx("div", { className: "panel-export-gif-label", children: "GIF" }),
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "panel-export-gif-row",
          role: "group",
          "aria-label": "GIF resolution",
          children: GIF_RES_PRESETS.map((preset, i) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cn(
                "panel-export-res-btn",
                i === gifResIndex && "panel-export-res-active"
              ),
              "aria-pressed": i === gifResIndex,
              title: `${preset.maxEdge}px longest edge`,
              onClick: () => setGifResIndex(i),
              disabled: controlsLocked,
              children: preset.label
            },
            preset.label
          ))
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "panel-export-gif-row", role: "group", "aria-label": "GIF duration", children: GIF_DURATION_OPTIONS.map((sec) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: cn(
            "panel-export-res-btn",
            gifDurationSec === sec && "panel-export-res-active"
          ),
          "aria-pressed": gifDurationSec === sec,
          onClick: () => setGifDurationSec(sec),
          disabled: controlsLocked,
          children: [
            sec,
            "s"
          ]
        },
        sec
      )) }),
      /* @__PURE__ */ jsx("div", { className: "panel-export-gif-row", role: "group", "aria-label": "GIF frame rate", children: GIF_FPS_OPTIONS.map((fps) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: cn(
            "panel-export-res-btn",
            gifFps === fps && "panel-export-res-active"
          ),
          "aria-pressed": gifFps === fps,
          onClick: () => setGifFps(fps),
          disabled: controlsLocked,
          children: [
            fps,
            " fps"
          ]
        },
        fps
      )) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-action-btn",
          onClick: () => void exportGif(),
          disabled: controlsLocked,
          children: gifBusy ? "Rendering GIF\u2026" : `Export GIF \xB7 ${GIF_RES_PRESETS[gifResIndex]?.label ?? "720"}p \xB7 ${gifDurationSec}s @ ${gifFps}fps`
        }
      )
    ] }),
    status ? /* @__PURE__ */ jsx("div", { className: "panel-status", children: status }) : null
  ] });
}

// src/prompts.ts
function fillPanelPrompt(prompt, shaderName) {
  const name = shaderName?.trim() || "shader";
  return prompt.replace(/\{\{\s*shader\s*\}\}/g, name);
}
function ControlSection({
  title,
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  onReset
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== void 0;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = (next) => {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };
  const toggle = () => setOpen(!open);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-panel-open": open ? "true" : "false",
      className: cn("panel-section", className),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-section-header", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-section-button",
              onClick: toggle,
              "aria-expanded": open,
              children: /* @__PURE__ */ jsx("span", { className: "panel-section-title", children: title })
            }
          ),
          onReset ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-section-reset",
              onClick: onReset,
              "aria-label": `Reset ${title} to defaults`,
              title: `Reset ${title}`,
              children: /* @__PURE__ */ jsx(ResetIcon2, {})
            }
          ) : null,
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-section-caret-btn",
              onClick: toggle,
              "aria-label": open ? "Collapse section" : "Expand section",
              tabIndex: -1,
              children: /* @__PURE__ */ jsx(CaretIcon, {})
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "panel-collapse", "data-panel-open": open ? "true" : "false", children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-section-children", children }) }) })
      ]
    }
  );
}
function CaretIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-section-caret",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx(
        "path",
        {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth: 2,
          d: "M19 9l-7 7-7-7"
        }
      )
    }
  );
}
function ResetIcon2() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }),
        /* @__PURE__ */ jsx("path", { d: "M3 3v5h5" })
      ]
    }
  );
}
function ControlQuickActions({
  title = "AI prompts",
  prompts,
  shaderName,
  className,
  defaultOpen = false
}) {
  const [expanded, setExpanded] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const resolved = useMemo(
    () => prompts.map((p) => ({
      ...p,
      prompt: fillPanelPrompt(p.prompt, shaderName)
    })),
    [prompts, shaderName]
  );
  const copy = useCallback((p) => {
    void navigator.clipboard.writeText(p.prompt);
    setCopiedId(p.id);
    window.setTimeout(() => {
      setCopiedId((id) => id === p.id ? null : id);
    }, 1400);
  }, []);
  if (resolved.length === 0) return null;
  return /* @__PURE__ */ jsx(
    ControlSection,
    {
      title,
      defaultOpen,
      className: cn("panel-quick-section", className),
      children: resolved.map((p) => {
        const isOpen = expanded === p.id;
        const isCopied = copiedId === p.id;
        return /* @__PURE__ */ jsx(
          PromptRow,
          {
            prompt: p,
            isOpen,
            isCopied,
            onToggle: () => setExpanded(isOpen ? null : p.id),
            onCopy: () => copy(p)
          },
          p.id
        );
      })
    }
  );
}
function PromptRow({
  prompt,
  isOpen,
  isCopied,
  onToggle,
  onCopy
}) {
  return /* @__PURE__ */ jsxs("div", { className: "panel-prompt", "data-panel-open": isOpen ? "true" : "false", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "panel-prompt-toggle",
        onClick: onToggle,
        "aria-expanded": isOpen,
        children: [
          /* @__PURE__ */ jsx("span", { className: "panel-prompt-label", children: prompt.title }),
          /* @__PURE__ */ jsx(CaretIcon2, {})
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-collapse",
        "data-panel-open": isOpen ? "true" : "false",
        "aria-hidden": !isOpen,
        children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsxs("div", { className: "panel-prompt-preview", children: [
          prompt.description ? /* @__PURE__ */ jsx("div", { className: "panel-prompt-desc", children: prompt.description }) : null,
          /* @__PURE__ */ jsxs("div", { className: "panel-prompt-code-wrap", children: [
            /* @__PURE__ */ jsx("pre", { className: "panel-prompt-pre", children: prompt.prompt }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "panel-prompt-copy",
                onClick: onCopy,
                "aria-label": isCopied ? "Copied" : "Copy prompt",
                title: isCopied ? "Copied" : "Copy prompt",
                children: isCopied ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(CopyIcon, {})
              }
            )
          ] })
        ] }) })
      }
    )
  ] });
}
function CaretIcon2() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-prompt-caret",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M19 9l-7 7-7-7" })
    }
  );
}
function CopyIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
        /* @__PURE__ */ jsx("path", { d: "M5 15V5a2 2 0 0 1 2-2h10" })
      ]
    }
  );
}
function CheckIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M5 12l5 5 9-12" })
    }
  );
}
function ControlAction({
  label,
  description,
  onClick,
  disabled = false,
  variant = "default",
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-action-field", className), children: [
    description ? /* @__PURE__ */ jsx("div", { className: "panel-field-description", children: description }) : null,
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: cn(
          "panel-action-btn",
          variant === "primary" && "panel-action-btn-primary",
          variant === "destructive" && "panel-action-btn-destructive"
        ),
        disabled,
        onClick,
        children: label
      }
    )
  ] });
}
function singular(label) {
  if (/ies$/i.test(label)) return label.replace(/ies$/i, "y");
  if (/ses$/i.test(label)) return label.replace(/es$/i, "");
  if (/s$/i.test(label)) return label.replace(/s$/i, "");
  return label;
}
var idCounter = 0;
function makeId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
  }
  idCounter += 1;
  return `item-${Date.now().toString(36)}-${idCounter}`;
}
function ControlCollection({
  field,
  items,
  onChange,
  renderContext,
  onSelect,
  className
}) {
  const multiOpen = field.multiOpen ?? false;
  const reorderable = field.reorderable ?? true;
  const canRemove = items.length > (field.min ?? 0);
  const canAdd = field.newItem != null && (field.max == null || items.length < field.max);
  const [openIds, setOpenIds] = useState(/* @__PURE__ */ new Set());
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const liveOnSelect = useRef(onSelect);
  liveOnSelect.current = onSelect;
  const setOpen = useCallback(
    (id, open) => {
      setOpenIds((prev) => {
        if (multiOpen) {
          const next2 = new Set(prev);
          if (open) next2.add(id);
          else next2.delete(id);
          return next2;
        }
        const next = open ? /* @__PURE__ */ new Set([id]) : /* @__PURE__ */ new Set();
        liveOnSelect.current?.(open ? id : null);
        return next;
      });
    },
    [multiOpen]
  );
  const replaceItem = useCallback(
    (index, nextItem) => {
      const next = items.slice();
      next[index] = nextItem;
      onChange(next);
    },
    [items, onChange]
  );
  const removeItem = useCallback(
    (index) => {
      const removed = items[index];
      const next = items.slice();
      next.splice(index, 1);
      onChange(next);
      if (removed) setOpen(removed.id, false);
    },
    [items, onChange, setOpen]
  );
  const addItem = useCallback(() => {
    if (!field.newItem) return;
    const made = field.newItem();
    const item = made && typeof made.id === "string" && made.id ? made : { ...made, id: makeId() };
    onChange([...items, item]);
    setOpen(item.id, true);
  }, [field, items, onChange, setOpen]);
  const moveItem = useCallback(
    (from, to) => {
      if (from === to || from < 0 || to < 0) return;
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [items, onChange]
  );
  return /* @__PURE__ */ jsxs("div", { className: `panel-collection${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "panel-collection-header", children: [
      /* @__PURE__ */ jsx("span", { className: "panel-collection-title", children: field.label }),
      /* @__PURE__ */ jsx("span", { className: "panel-collection-count", children: items.length }),
      field.newItem ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-collection-add",
          disabled: !canAdd,
          onClick: addItem,
          children: field.addLabel ?? `Add ${singular(field.label)}`
        }
      ) : null
    ] }),
    field.description ? /* @__PURE__ */ jsx("div", { className: "panel-field-description", children: field.description }) : null,
    /* @__PURE__ */ jsxs("div", { className: "panel-collection-items", children: [
      items.map((item, index) => {
        const open = openIds.has(item.id);
        const title = field.itemLabel ? field.itemLabel(item, index) : `${field.label} ${index + 1}`;
        const itemFields = typeof field.itemFields === "function" ? field.itemFields(item, index) : field.itemFields;
        const setItem = (next) => replaceItem(index, next);
        const rendered = [];
        if (open) {
          for (const f of itemFields) {
            if (f.type === "section") continue;
            const out = renderPanelField(f, {
              ...renderContext,
              values: item,
              setValues: setItem
            });
            if (out) rendered.push(out);
          }
        }
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "panel-collection-row",
            "data-panel-open": open ? "true" : "false",
            "data-panel-dragging": dragIndex === index ? "true" : "false",
            "data-panel-dragover": overIndex === index ? "true" : "false",
            onDragOver: reorderable && dragIndex != null ? (e) => {
              e.preventDefault();
              setOverIndex(index);
            } : void 0,
            onDrop: reorderable && dragIndex != null ? (e) => {
              e.preventDefault();
              moveItem(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            } : void 0,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "panel-collection-row-head", children: [
                reorderable ? /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: "panel-collection-drag",
                    role: "button",
                    tabIndex: -1,
                    "aria-label": "Drag to reorder",
                    draggable: true,
                    onDragStart: (e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragIndex(index);
                    },
                    onDragEnd: () => {
                      setDragIndex(null);
                      setOverIndex(null);
                    },
                    children: /* @__PURE__ */ jsx(DragIcon, {})
                  }
                ) : null,
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    className: "panel-collection-row-toggle",
                    "aria-expanded": open,
                    onClick: () => setOpen(item.id, !open),
                    children: [
                      /* @__PURE__ */ jsx("span", { className: "panel-collection-row-label", children: title }),
                      /* @__PURE__ */ jsx(CaretIcon3, {})
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    className: "panel-collection-remove",
                    "aria-label": "Remove",
                    disabled: !canRemove,
                    onClick: () => removeItem(index),
                    children: /* @__PURE__ */ jsx(CloseIcon2, {})
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "panel-collapse",
                  "data-panel-open": open ? "true" : "false",
                  "aria-hidden": !open,
                  children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-collection-row-body", children: rendered.map((r) => /* @__PURE__ */ jsx("div", { className: "panel-field", children: r.node }, r.reactKey)) }) })
                }
              )
            ]
          },
          item.id
        );
      }),
      items.length === 0 ? /* @__PURE__ */ jsx("div", { className: "panel-collection-empty", children: "No items" }) : null
    ] })
  ] });
}
function CaretIcon3() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-collection-caret",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M19 9l-7 7-7-7" })
    }
  );
}
function CloseIcon2() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" })
    }
  );
}
function DragIcon() {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "6", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "6", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "12", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "12", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "18", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "18", r: "1.4" })
  ] });
}
function ControlColorInput({
  label,
  value,
  onChange,
  className
}) {
  const hiddenRef = useRef(null);
  const openPicker = () => {
    const input = hiddenRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
    }
    input.click();
  };
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-color", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-color-label", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "panel-color-right", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: value.toUpperCase(),
          onChange: (e) => onChange(e.target.value),
          className: "panel-color-text"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: openPicker,
          className: "panel-color-swatch",
          style: { background: value },
          "aria-label": `Pick color for ${label}`
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          ref: hiddenRef,
          type: "color",
          value,
          onChange: (e) => onChange(e.target.value),
          className: "panel-color-native",
          tabIndex: -1,
          "aria-hidden": "true"
        }
      )
    ] })
  ] });
}
function ControlImageInput({
  label,
  value,
  onChange,
  readonly = false,
  accept = "image/*",
  emptyLabel,
  className
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [aspect, setAspect] = useState(null);
  const interactive = !readonly && !!onChange;
  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    onChange?.(URL.createObjectURL(file));
  };
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-image", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "panel-image-head", children: [
      /* @__PURE__ */ jsx("span", { className: "panel-image-label", children: label }),
      interactive ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-image-upload",
          onClick: () => inputRef.current?.click(),
          children: "Upload"
        }
      ) : null
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-image-frame",
        style: value && aspect ? (
          // Frame at the image's natural aspect; the img inside renders at
          // 75% so it floats clear of the frame edges.
          { aspectRatio: `${aspect}` }
        ) : void 0,
        "data-panel-interactive": interactive ? "true" : "false",
        "data-panel-drag": dragOver ? "true" : "false",
        role: interactive ? "button" : void 0,
        tabIndex: interactive ? 0 : void 0,
        "aria-label": interactive ? `Upload image for ${label}` : label,
        onClick: interactive ? () => inputRef.current?.click() : void 0,
        onKeyDown: interactive ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        } : void 0,
        onDragOver: interactive ? (e) => {
          e.preventDefault();
          setDragOver(true);
        } : void 0,
        onDragLeave: interactive ? () => setDragOver(false) : void 0,
        onDrop: interactive ? (e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        } : void 0,
        children: value ? /* @__PURE__ */ jsx(
          "img",
          {
            src: value,
            alt: label,
            className: "panel-image-preview",
            draggable: false,
            onLoad: (e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setAspect(img.naturalWidth / img.naturalHeight);
              }
            }
          }
        ) : /* @__PURE__ */ jsx("span", { className: "panel-image-empty", children: emptyLabel ?? (readonly ? "\u2014" : "Click or drop an image") })
      }
    ),
    interactive ? /* @__PURE__ */ jsx(
      "input",
      {
        ref: inputRef,
        type: "file",
        accept,
        className: "panel-image-native",
        tabIndex: -1,
        "aria-hidden": "true",
        onChange: (e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }
      }
    ) : null
  ] });
}
var VB = 100;
var ANCHOR_DRAG = -1;
var HIT_RADIUS_PAD = 8;
var MIN_ADD_DISTANCE = 0.06;
function ControlPath({
  label,
  value,
  onChange,
  min,
  max,
  anchor,
  onAnchorChange,
  emptyLabel,
  className
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const pendingAddRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const span = max - min || 1;
  const toPad = useCallback(
    (p) => [
      (p[0] - min) / span * VB,
      (max - p[1]) / span * VB
    ],
    [min, max, span]
  );
  const fromEvent = useCallback(
    (e) => {
      const svg = svgRef.current;
      if (!svg) return [0, 0];
      const r = svg.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      return [
        +(min + px * span).toFixed(3),
        +(max - py * span).toFixed(3)
      ];
    },
    [min, max, span]
  );
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const tooCloseToAnchor = useCallback(
    (p) => {
      if (!anchor || !onAnchorChange) return false;
      return distance(p, anchor) < MIN_ADD_DISTANCE;
    },
    [anchor, onAnchorChange]
  );
  const setPoint = (i, p) => {
    const next = value.map((pt, idx) => idx === i ? p : pt);
    onChange(next);
  };
  const addPoint = (p) => {
    if (tooCloseToAnchor(p)) return;
    for (const pt of value) {
      if (distance(p, pt) < MIN_ADD_DISTANCE) return;
    }
    onChange([...value, p]);
    setSelected(value.length);
  };
  const removePoint = (i) => {
    onChange(value.filter((_, idx) => idx !== i));
    setSelected(null);
  };
  const beginPointer = (e) => {
    pendingAddRef.current = null;
    movedRef.current = false;
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerDownPoint = (e, i) => {
    e.stopPropagation();
    beginPointer(e);
    dragRef.current = i;
    setSelected(i);
  };
  const onPointerDownAnchor = (e) => {
    if (!onAnchorChange) return;
    e.stopPropagation();
    beginPointer(e);
    dragRef.current = ANCHOR_DRAG;
    setSelected("anchor");
  };
  const onPointerDownBackground = (e) => {
    e.stopPropagation();
    beginPointer(e);
    dragRef.current = null;
    pendingAddRef.current = fromEvent(e);
    setSelected(null);
  };
  const onPointerMove = (e) => {
    if (dragRef.current === null && pendingAddRef.current === null) return;
    movedRef.current = true;
    const next = fromEvent(e);
    if (dragRef.current === ANCHOR_DRAG) {
      onAnchorChange?.(next);
      return;
    }
    if (dragRef.current !== null) {
      setPoint(dragRef.current, next);
    }
  };
  const onPointerUp = (e) => {
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (dragRef.current !== null) {
      dragRef.current = null;
      movedRef.current = false;
      pendingAddRef.current = null;
      return;
    }
    if (pendingAddRef.current !== null && !movedRef.current) {
      addPoint(pendingAddRef.current);
    }
    dragRef.current = null;
    movedRef.current = false;
    pendingAddRef.current = null;
  };
  const chain = anchor ? [anchor, ...value] : [...value];
  const chainPad = chain.map(toPad);
  const polyline = chainPad.map(([x, y]) => `${x},${y}`).join(" ");
  const closeFrom = chainPad[chainPad.length - 1];
  const closeTo = chainPad[0];
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-path", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "panel-path-head", children: [
      /* @__PURE__ */ jsx("span", { className: "panel-path-label", children: label }),
      /* @__PURE__ */ jsxs("div", { className: "panel-path-head-actions", children: [
        /* @__PURE__ */ jsx("span", { className: "panel-path-count", children: value.length === 0 ? emptyLabel ?? "click to add" : `${value.length} pt${value.length === 1 ? "" : "s"}` }),
        value.length > 0 ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "panel-path-clear",
            onClick: () => {
              onChange([]);
              setSelected(null);
            },
            children: "Clear"
          }
        ) : null
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "svg",
      {
        ref: svgRef,
        className: "panel-path-pad",
        viewBox: `0 0 ${VB} ${VB}`,
        preserveAspectRatio: "none",
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        children: [
          /* @__PURE__ */ jsx(
            "rect",
            {
              x: "0",
              y: "0",
              width: VB,
              height: VB,
              className: "panel-path-bg",
              onPointerDown: onPointerDownBackground
            }
          ),
          /* @__PURE__ */ jsx(
            "line",
            {
              x1: "50",
              y1: "0",
              x2: "50",
              y2: VB,
              className: "panel-path-grid",
              pointerEvents: "none"
            }
          ),
          /* @__PURE__ */ jsx(
            "line",
            {
              x1: "0",
              y1: "50",
              x2: VB,
              y2: "50",
              className: "panel-path-grid",
              pointerEvents: "none"
            }
          ),
          /* @__PURE__ */ jsx(
            "rect",
            {
              x: "0.5",
              y: "0.5",
              width: VB - 1,
              height: VB - 1,
              className: "panel-path-frame",
              pointerEvents: "none"
            }
          ),
          chain.length > 1 ? /* @__PURE__ */ jsx(
            "polyline",
            {
              points: polyline,
              className: "panel-path-line",
              pointerEvents: "none"
            }
          ) : null,
          chain.length > 1 ? /* @__PURE__ */ jsx(
            "line",
            {
              x1: closeFrom[0],
              y1: closeFrom[1],
              x2: closeTo[0],
              y2: closeTo[1],
              className: "panel-path-line-close",
              pointerEvents: "none"
            }
          ) : null,
          value.map((p, i) => {
            const [x, y] = toPad(p);
            return /* @__PURE__ */ jsxs(
              "g",
              {
                className: cn(
                  "panel-path-point",
                  selected === i && "is-selected"
                ),
                onPointerDown: (e) => onPointerDownPoint(e, i),
                onDoubleClick: (e) => {
                  e.stopPropagation();
                  removePoint(i);
                },
                children: [
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: x,
                      cy: y,
                      r: HIT_RADIUS_PAD,
                      className: "panel-path-point-hit"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: x,
                      cy: y,
                      r: "3",
                      className: "panel-path-point-ring",
                      pointerEvents: "none"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "text",
                    {
                      x,
                      y,
                      className: "panel-path-point-num",
                      dy: "0.35em",
                      pointerEvents: "none",
                      children: i + 1
                    }
                  )
                ]
              },
              i
            );
          }),
          anchor ? (() => {
            const [ax, ay] = toPad(anchor);
            const anchorDraggable = Boolean(onAnchorChange);
            return /* @__PURE__ */ jsxs(
              "g",
              {
                className: cn(
                  "panel-path-anchor",
                  anchorDraggable && "is-draggable",
                  selected === "anchor" && "is-selected"
                ),
                style: { pointerEvents: anchorDraggable ? "auto" : "none" },
                onPointerDown: anchorDraggable ? onPointerDownAnchor : void 0,
                children: [
                  anchorDraggable ? /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: ax,
                      cy: ay,
                      r: HIT_RADIUS_PAD,
                      className: "panel-path-point-hit"
                    }
                  ) : null,
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: ax,
                      cy: ay,
                      r: "3.4",
                      pointerEvents: "none"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: ax,
                      cy: ay,
                      r: "1.1",
                      className: "panel-path-anchor-dot",
                      pointerEvents: "none"
                    }
                  )
                ]
              }
            );
          })() : null
        ]
      }
    ),
    selected === "anchor" && anchor ? /* @__PURE__ */ jsx("div", { className: "panel-path-selected", children: /* @__PURE__ */ jsxs("span", { children: [
      "Home: ",
      anchor[0].toFixed(2),
      ", ",
      anchor[1].toFixed(2)
    ] }) }) : selected !== null && typeof selected === "number" && value[selected] ? /* @__PURE__ */ jsxs("div", { className: "panel-path-selected", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        "Point ",
        selected + 1,
        ": ",
        value[selected][0].toFixed(2),
        ",",
        " ",
        value[selected][1].toFixed(2)
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-path-remove",
          onClick: () => removePoint(selected),
          children: "Remove"
        }
      )
    ] }) : /* @__PURE__ */ jsx("div", { className: "panel-path-hint", children: "Click empty space to add \xB7 drag home or waypoints to move \xB7 double-click to remove" })
  ] });
}
function ControlPresets({
  presets,
  values,
  onChange,
  label = "Preset",
  className,
  actionHandlers
}) {
  const handleChange = (e) => {
    const picked = e.target.value;
    e.target.selectedIndex = 0;
    if (!picked) return;
    const preset = presets.find((p) => p.label === picked);
    if (!preset) return;
    if (preset.actionId) {
      actionHandlers?.[preset.actionId]?.();
      return;
    }
    if (preset.values) {
      const next = typeof preset.values === "function" ? preset.values(values) : { ...values, ...preset.values };
      onChange(next);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-presets", className), children: [
    /* @__PURE__ */ jsx("label", { className: "panel-presets-label", children: label }),
    /* @__PURE__ */ jsxs(
      "select",
      {
        className: "panel-preset-select",
        defaultValue: "",
        onChange: handleChange,
        "aria-label": label,
        children: [
          /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select preset\u2026" }),
          presets.map((preset) => /* @__PURE__ */ jsx("option", { value: preset.label, children: preset.label }, preset.label))
        ]
      }
    )
  ] });
}
function ControlOptionList({
  items,
  onSelect,
  title,
  emptyLabel = "No matches",
  className
}) {
  if (items.length === 0) {
    return emptyLabel ? /* @__PURE__ */ jsx("div", { className: cn("panel-option-empty", className), children: emptyLabel }) : null;
  }
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-option-list-wrap", className), children: [
    title ? /* @__PURE__ */ jsx("div", { className: "panel-option-list-title", children: title }) : null,
    /* @__PURE__ */ jsx("div", { className: "panel-option-list", role: "listbox", "aria-label": title ?? "Options", children: items.map((item) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        role: "option",
        className: "panel-option-item",
        disabled: item.disabled,
        onClick: () => onSelect(item.id),
        children: [
          /* @__PURE__ */ jsx("span", { className: "panel-option-item-label", children: item.label }),
          item.description ? /* @__PURE__ */ jsx("span", { className: "panel-option-item-desc", children: item.description }) : null
        ]
      },
      item.id
    )) })
  ] });
}
function ControlReadout({
  label,
  value,
  emptyValue = "None",
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-readout", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-readout-label", children: label }),
    /* @__PURE__ */ jsx("span", { className: "panel-readout-value", children: value?.trim() || emptyValue })
  ] });
}
function ControlReference({
  field,
  value,
  onChange,
  rootValues,
  className
}) {
  const [open, setOpen] = useState(false);
  const target = rootValues[field.collection] ?? [];
  const labelOf = (item) => field.optionLabel ? field.optionLabel(item) : item.id;
  const selectedIds = field.multiple ? Array.isArray(value) ? value : [] : typeof value === "string" && value ? [value] : [];
  const currentLabel = selectedIds.map((id) => {
    const item = target.find((it) => it.id === id);
    return item ? labelOf(item) : id;
  }).join(", ");
  const pick = (id) => {
    if (field.multiple) {
      const set = new Set(selectedIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      onChange(Array.from(set));
    } else {
      onChange(id);
      setOpen(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: `panel-reference${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "panel-reference-trigger",
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
        children: /* @__PURE__ */ jsx(
          ControlReadout,
          {
            label: field.label,
            value: currentLabel,
            emptyValue: field.placeholder ?? "None"
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-collapse",
        "data-panel-open": open ? "true" : "false",
        "aria-hidden": !open,
        children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-reference-picker", children: /* @__PURE__ */ jsx(
          ControlOptionList,
          {
            items: target.map((item) => ({
              id: item.id,
              label: labelOf(item),
              description: selectedIds.includes(item.id) ? "Selected" : void 0
            })),
            onSelect: pick,
            emptyLabel: "No items to link"
          }
        ) }) })
      }
    )
  ] });
}
var MENU_MAX_HEIGHT = 260;
var MENU_GAP = 6;
function ControlSelect({
  label,
  value,
  options,
  onChange,
  layout = "stacked",
  className
}) {
  const theme = usePanelThemeContext();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const selectedIndex = options.findIndex(
    (o) => String(o.value) === String(value)
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : void 0;
  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < Math.min(MENU_MAX_HEIGHT, options.length * 32) + 16;
    setPos({
      top: up ? r.top - MENU_GAP : r.bottom + MENU_GAP,
      left: r.right,
      width: Math.max(r.width, 160),
      up
    });
  }, [options.length]);
  const openMenu = useCallback(() => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    place();
    setOpen(true);
  }, [place, selectedIndex]);
  const commit = useCallback(
    (index) => {
      const opt = options[index];
      if (opt) onChange(opt.value);
      setOpen(false);
      btnRef.current?.focus();
    },
    [onChange, options]
  );
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const t = e.target;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector(`[data-panel-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  const onKeyDown = (e) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn("panel-select", className),
      "data-panel-layout": layout,
      children: [
        /* @__PURE__ */ jsx("span", { className: "panel-select-label", children: label }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            ref: btnRef,
            type: "button",
            className: "panel-select-btn",
            "aria-haspopup": "listbox",
            "aria-expanded": open,
            "aria-label": label,
            onClick: () => open ? setOpen(false) : openMenu(),
            onKeyDown,
            children: [
              /* @__PURE__ */ jsx("span", { className: "panel-select-value", children: selected?.label ?? "\u2014" }),
              /* @__PURE__ */ jsx(
                "svg",
                {
                  className: "panel-select-chevron",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 2.4,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": "true",
                  children: /* @__PURE__ */ jsx("path", { d: "M6 9l6 6 6-6" })
                }
              )
            ]
          }
        ),
        open && pos ? createPortal(
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-panel": "",
              "data-panel-theme": theme,
              className: "panel-select-layer",
              children: /* @__PURE__ */ jsx(
                "div",
                {
                  ref: menuRef,
                  role: "listbox",
                  "aria-label": label,
                  className: "panel-select-menu",
                  "data-panel-up": pos.up ? "true" : "false",
                  style: {
                    position: "fixed",
                    left: pos.left,
                    top: pos.top,
                    minWidth: pos.width,
                    maxHeight: MENU_MAX_HEIGHT,
                    transform: `translate(-100%, ${pos.up ? "-100%" : "0"})`
                  },
                  children: options.map((o, i) => {
                    const isSelected = i === selectedIndex;
                    return /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        role: "option",
                        "aria-selected": isSelected,
                        "data-panel-index": i,
                        "data-panel-active": i === active ? "true" : "false",
                        className: "panel-select-option",
                        onMouseEnter: () => setActive(i),
                        onClick: () => commit(i),
                        children: [
                          /* @__PURE__ */ jsx("span", { children: o.label }),
                          isSelected ? /* @__PURE__ */ jsx(
                            "svg",
                            {
                              className: "panel-select-check",
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: 2.4,
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                              "aria-hidden": "true",
                              children: /* @__PURE__ */ jsx("path", { d: "M5 13l4 4L19 7" })
                            }
                          ) : null
                        ]
                      },
                      String(o.value)
                    );
                  })
                }
              )
            }
          ),
          document.body
        ) : null
      ]
    }
  );
}
function decimalsForStep(s) {
  const str = s.toString();
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}
function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
var FRICTION = 0.94;
var MIN_VELOCITY = 2e-5;
var MAX_VELOCITY = 6e-3;
function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  className
}) {
  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const handleRef = useRef(null);
  const overscrollRef = useRef(null);
  const [state, setState] = useState("idle");
  const percentage = (value - min) / (max - min) * 100;
  const decimals = decimalsForStep(step);
  const displayValue = value.toFixed(decimals);
  useEffect(() => {
    const fill = fillRef.current;
    const handle = handleRef.current;
    if (fill) fill.style.setProperty("--panel-fill-pct", `${percentage}%`);
    if (handle) handle.style.setProperty("--panel-handle-left", `${percentage}%`);
  }, [percentage]);
  const fractionToValue = useCallback(
    (frac) => {
      const clamped = Math.max(0, Math.min(1, frac));
      const raw = min + clamped * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.max(
        min,
        Math.min(max, Number.parseFloat(stepped.toFixed(decimals)))
      );
    },
    [min, max, step, decimals]
  );
  const positionToValue = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      return fractionToValue((clientX - rect.left) / rect.width);
    },
    [fractionToValue, value]
  );
  const onChangeRef = useRef(onChange);
  const fractionToValueRef = useRef(fractionToValue);
  const positionToValueRef = useRef(positionToValue);
  onChangeRef.current = onChange;
  fractionToValueRef.current = fractionToValue;
  positionToValueRef.current = positionToValue;
  const setOverscroll = useCallback((scale, origin) => {
    const el = overscrollRef.current;
    if (!el) return;
    el.style.setProperty("--panel-os-scale", String(scale));
    el.style.setProperty("--panel-os-origin", origin);
  }, []);
  const paintFraction = useCallback((frac) => {
    const clamped = Math.max(0, Math.min(1, frac));
    const pct = `${clamped * 100}%`;
    if (fillRef.current)
      fillRef.current.style.setProperty("--panel-fill-pct", pct);
    if (handleRef.current)
      handleRef.current.style.setProperty("--panel-handle-left", pct);
  }, []);
  const rafRef = useRef(null);
  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const reduced = prefersReducedMotion();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setState("drag");
      onChangeRef.current(positionToValueRef.current(e.clientX));
      const overscrollEl = overscrollRef.current;
      if (overscrollEl) overscrollEl.dataset.panelRelease = "false";
      let lastFrac = 0;
      let lastT = e.timeStamp;
      let velocity = 0;
      const rawFraction = (clientX) => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        return (clientX - rect.left) / rect.width;
      };
      lastFrac = rawFraction(e.clientX);
      const onMove = (ev) => {
        ev.preventDefault();
        const rawPct = rawFraction(ev.clientX);
        const now = ev.timeStamp;
        const dt = now - lastT;
        if (dt > 0) {
          velocity = (rawPct - lastFrac) / dt;
          lastT = now;
          lastFrac = rawPct;
        }
        if (!reduced) {
          if (rawPct < 0) {
            const d = Math.abs(rawPct);
            const v = (1 - 1 / (d * 3 + 1)) * 0.02;
            setOverscroll(1 + v, "100% 50%");
          } else if (rawPct > 1) {
            const d = rawPct - 1;
            const v = (1 - 1 / (d * 3 + 1)) * 0.02;
            setOverscroll(1 + v, "0% 50%");
          } else {
            setOverscroll(1, "50% 50%");
          }
        }
        onChangeRef.current(fractionToValueRef.current(rawPct));
      };
      const springBack = () => {
        if (!overscrollEl) return;
        overscrollEl.dataset.panelRelease = "true";
        setOverscroll(1, "50% 50%");
        const clear = () => {
          overscrollEl.dataset.panelRelease = "false";
          overscrollEl.removeEventListener("transitionend", clear);
        };
        overscrollEl.addEventListener("transitionend", clear);
      };
      const finishDrag = () => {
        setState((prev) => prev === "drag" ? "hover" : prev);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (reduced) {
          setOverscroll(1, "50% 50%");
          finishDrag();
          return;
        }
        springBack();
        let v = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
        let frac = lastFrac;
        let last = performance.now();
        if (Math.abs(v) < MIN_VELOCITY) {
          finishDrag();
          return;
        }
        const coast = (t) => {
          const dt = t - last;
          last = t;
          frac += v * dt;
          v *= Math.pow(FRICTION, dt / 16);
          const visual = Math.max(0, Math.min(1, frac));
          paintFraction(visual);
          onChangeRef.current(fractionToValueRef.current(visual));
          const atEdge = frac <= 0 || frac >= 1;
          if (Math.abs(v) < MIN_VELOCITY || atEdge) {
            const final = fractionToValueRef.current(visual);
            onChangeRef.current(final);
            paintFraction((final - min) / (max - min));
            rafRef.current = null;
            finishDrag();
            return;
          }
          rafRef.current = requestAnimationFrame(coast);
        };
        rafRef.current = requestAnimationFrame(coast);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setOverscroll, paintFraction, min, max]
  );
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  const discreteSteps = (max - min) / step;
  const hashCount = discreteSteps <= 10 ? discreteSteps - 1 : 9;
  const hashMarks = Array.from({ length: hashCount }, (_, i) => {
    const pct = discreteSteps <= 10 ? (i + 1) * step / (max - min) * 100 : (i + 1) * 10;
    return /* @__PURE__ */ jsx("div", { className: "panel-slider-hash", style: { left: `${pct}%` } }, `h${pct}`);
  });
  return /* @__PURE__ */ jsx("div", { "data-panel-state": state, className: cn("panel-slider", className), children: /* @__PURE__ */ jsx("div", { ref: overscrollRef, className: "panel-slider-overscroll", children: /* @__PURE__ */ jsxs(
    "div",
    {
      ref: trackRef,
      role: "slider",
      tabIndex: 0,
      "aria-valuenow": value,
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-label": label,
      className: "panel-slider-track",
      onPointerDown: handlePointerDown,
      onPointerEnter: () => setState((s) => s === "drag" ? s : "hover"),
      onPointerLeave: () => setState((s) => s === "drag" ? s : "idle"),
      children: [
        /* @__PURE__ */ jsx("div", { className: "panel-slider-hash-row", children: hashMarks }),
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: fillRef,
            className: "panel-slider-fill",
            style: { "--panel-fill-pct": `${percentage}%` }
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: handleRef,
            className: "panel-slider-handle",
            style: { "--panel-handle-left": `${percentage}%` }
          }
        ),
        /* @__PURE__ */ jsx("span", { className: "panel-slider-label", children: label }),
        /* @__PURE__ */ jsx("span", { className: "panel-slider-value", children: displayValue })
      ]
    }
  ) }) });
}
function ControlToggle({
  label,
  value,
  onChange,
  className
}) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": value,
      "aria-label": label,
      onClick: () => onChange(!value),
      className: cn("panel-toggle", className),
      "data-panel-on": value ? "true" : "false",
      children: [
        /* @__PURE__ */ jsx("span", { className: "panel-toggle-label", children: label }),
        /* @__PURE__ */ jsx("span", { className: "panel-toggle-track", children: /* @__PURE__ */ jsx("span", { className: "panel-toggle-thumb" }) })
      ]
    }
  );
}
function ControlVec2({
  label,
  value,
  min,
  max,
  step,
  xLabel = "X",
  yLabel = "Y",
  onChange,
  className
}) {
  const setX = useCallback(
    (x) => onChange([x, value[1]]),
    [onChange, value]
  );
  const setY = useCallback(
    (y) => onChange([value[0], y]),
    [onChange, value]
  );
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-vec2", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-vec2-label", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "panel-vec2-row", children: [
      /* @__PURE__ */ jsx(
        ControlSlider,
        {
          label: xLabel,
          value: value[0],
          min,
          max,
          step,
          onChange: setX
        }
      ),
      /* @__PURE__ */ jsx(
        ControlSlider,
        {
          label: yLabel,
          value: value[1],
          min,
          max,
          step,
          onChange: setY
        }
      )
    ] })
  ] });
}
function renderPanelField(field, ctx) {
  const { values, setValues, rootValues, setRootValues, actionHandlers } = ctx;
  const setKey = (key, val) => {
    setValues({ ...values, [key]: val });
  };
  const withDescription = (description, node) => description ? /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "panel-field-description", children: description }),
    node
  ] }) : node;
  switch (field.type) {
    case "action": {
      if (field.when && !field.when(values)) return null;
      const handler = actionHandlers?.[field.actionId];
      return {
        reactKey: field.actionId,
        node: /* @__PURE__ */ jsx(
          ControlAction,
          {
            label: field.label,
            description: field.description,
            variant: field.variant,
            disabled: !handler,
            onClick: () => handler?.()
          }
        )
      };
    }
    case "presets": {
      return {
        reactKey: `presets-${field.presets.map((p) => p.label).join("-")}`,
        node: /* @__PURE__ */ jsx(
          ControlPresets,
          {
            label: field.label,
            presets: field.presets,
            values,
            onChange: setValues,
            actionHandlers
          }
        )
      };
    }
    case "slider":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlSlider,
            {
              label: field.label,
              value: values[field.key],
              min: field.min,
              max: field.max,
              step: field.step,
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "toggle":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlToggle,
            {
              label: field.label,
              value: values[field.key],
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "select":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlSelect,
            {
              label: field.label,
              value: values[field.key],
              options: field.options,
              layout: field.layout,
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "toggle-group":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlToggleGroup,
            {
              label: field.label,
              value: values[field.key],
              options: field.options,
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "vec2":
      return {
        reactKey: field.key,
        node: /* @__PURE__ */ jsx(
          ControlVec2,
          {
            label: field.label,
            value: values[field.key],
            min: field.min,
            max: field.max,
            step: field.step,
            xLabel: field.xLabel,
            yLabel: field.yLabel,
            onChange: (v) => setKey(field.key, v)
          }
        )
      };
    case "image":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlImageInput,
            {
              label: field.label,
              value: values[field.key] ?? "",
              readonly: field.readonly,
              accept: field.accept,
              emptyLabel: field.emptyLabel,
              onChange: field.readonly ? void 0 : (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "path": {
      const anchor = field.anchorKey ? values[field.anchorKey] : void 0;
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlPath,
            {
              label: field.label,
              value: values[field.key] ?? [],
              min: field.min,
              max: field.max,
              anchor,
              onChange: (v) => setKey(field.key, v),
              onAnchorChange: field.anchorKey ? (v) => setKey(field.anchorKey, v) : void 0
            }
          )
        )
      };
    }
    case "collection": {
      const collectionField = field;
      return {
        reactKey: field.key,
        node: /* @__PURE__ */ jsx(
          ControlCollection,
          {
            field: collectionField,
            items: values[field.key] ?? [],
            onChange: (next) => setKey(field.key, next),
            renderContext: ctx,
            onSelect: ctx.onCollectionSelect ? (id) => ctx.onCollectionSelect?.(field.key, id) : void 0
          }
        )
      };
    }
    case "reference":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlReference,
            {
              field,
              value: values[field.key],
              onChange: (v) => setKey(field.key, v),
              rootValues,
              setRootValues
            }
          )
        )
      };
    case "color":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlColorInput,
            {
              label: field.label,
              value: values[field.key],
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
  }
}
var EMPTY_PROMPTS = [];
function Panel({
  id,
  title,
  titleSlot,
  side = "right",
  open,
  onClose,
  onOpen,
  values,
  defaults,
  fields,
  onChange,
  onWriteConfig,
  writeLabel = "Write config file",
  shortcutHint = false,
  prompts = EMPTY_PROMPTS,
  persist = true,
  defaultTheme,
  themeStorageKey,
  showThemeToggle,
  actionHandlers,
  container: container2,
  inline = false,
  peek,
  showAnimation = true,
  showExport = true,
  onSelect
}) {
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState(null);
  const [sectionOpen, setSectionOpen] = useState({});
  const pasteTextareaRef = useRef(null);
  useEffect(() => {
    if (!pasteOpen) return;
    const id2 = window.setTimeout(() => {
      const el = pasteTextareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
    return () => window.clearTimeout(id2);
  }, [pasteOpen]);
  const imageKeys = useMemo(() => {
    const keys = /* @__PURE__ */ new Set();
    for (const f of fields) {
      if (f.type === "image") keys.add(f.key);
    }
    return keys;
  }, [fields]);
  const collectionMigrations = useMemo(() => {
    const out = /* @__PURE__ */ new Map();
    for (const f of fields) {
      if (f.type === "collection" && f.migrate) {
        out.set(f.key, f.migrate);
      }
    }
    return out;
  }, [fields]);
  const stripImages = useCallback(
    (obj) => {
      if (imageKeys.size === 0) return obj;
      const out = { ...obj };
      for (const k of imageKeys) delete out[k];
      return out;
    },
    [imageKeys]
  );
  const valuesJson = useMemo(
    () => JSON.stringify(stripImages(values)),
    [values, stripImages]
  );
  const defaultsJson = useMemo(
    () => JSON.stringify(stripImages(defaults)),
    [defaults, stripImages]
  );
  const isModified = valuesJson !== defaultsJson;
  const persistKey = persist && id ? id : null;
  const sectionsKey = id ?? null;
  const liveRef = useRef({ onChange, defaults, values, valuesJson, stripImages });
  liveRef.current = { onChange, defaults, values, valuesJson, stripImages };
  const hydratedIdRef = useRef(null);
  useEffect(() => {
    if (!persistKey) return;
    if (hydratedIdRef.current === persistKey) return;
    hydratedIdRef.current = persistKey;
    if (!hasPersistedPanelValues(persistKey)) return;
    const live = liveRef.current;
    const saved = loadPersistedPanelValues(persistKey, live.defaults);
    for (const k of imageKeys) {
      if (k in live.values) {
        saved[k] = live.values[k];
      }
    }
    for (const [k, migrate] of collectionMigrations) {
      const arr = saved[k];
      if (Array.isArray(arr)) {
        saved[k] = migrate(
          arr
        );
      }
    }
    if (JSON.stringify(live.stripImages(saved)) !== live.valuesJson) {
      live.onChange(saved);
    }
  }, [persistKey, imageKeys, collectionMigrations]);
  const skipNextPersistRef = useRef(true);
  useEffect(() => {
    if (!persistKey) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (isModified) {
      persistPanelValues(persistKey, JSON.parse(valuesJson));
    } else {
      clearPersistedPanelValues(persistKey);
    }
  }, [persistKey, valuesJson, isModified]);
  const sectionHydratedIdRef = useRef(null);
  useEffect(() => {
    if (!sectionsKey) return;
    if (sectionHydratedIdRef.current === sectionsKey) return;
    sectionHydratedIdRef.current = sectionsKey;
    setSectionOpen(loadPersistedPanelSections(sectionsKey));
  }, [sectionsKey]);
  const setSectionOpenState = useCallback((title2, open2) => {
    setSectionOpen((prev) => ({ ...prev, [title2]: open2 }));
  }, []);
  const skipNextSectionPersistRef = useRef(true);
  useEffect(() => {
    if (!sectionsKey) return;
    if (skipNextSectionPersistRef.current) {
      skipNextSectionPersistRef.current = false;
      return;
    }
    persistPanelSections(sectionsKey, sectionOpen);
  }, [sectionsKey, sectionOpen]);
  const resetAll = useCallback(() => {
    onChange({ ...defaults });
    if (persistKey) clearPersistedPanelValues(persistKey);
    if (sectionsKey) clearPersistedPanelSections(sectionsKey);
    setSectionOpen({});
    setStatus(null);
  }, [defaults, onChange, persistKey, sectionsKey]);
  const handleApplyPaste = useCallback(() => {
    try {
      const parsed = JSON.parse(pasteText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object");
      }
      const next = { ...values };
      let applied = 0;
      for (const key of Object.keys(defaults)) {
        if (key in parsed && parsed[key] !== void 0) {
          next[key] = parsed[key];
          applied += 1;
        }
      }
      if (applied === 0) {
        throw new Error("No known keys found");
      }
      onChange(next);
      setPasteOpen(false);
      setPasteText("");
      setPasteError(null);
      setStatus(`Applied ${applied} key${applied === 1 ? "" : "s"}`);
      setTimeout(() => setStatus(null), 2e3);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [defaults, onChange, pasteText, values]);
  const configJson = useMemo(
    () => JSON.stringify(stripImages(values), null, 2),
    [values, stripImages]
  );
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(configJson);
    setStatus("Copied JSON to clipboard");
    setTimeout(() => setStatus(null), 2e3);
  }, [configJson]);
  const handleWrite = useCallback(async () => {
    if (!onWriteConfig) return;
    setWriting(true);
    setStatus(null);
    try {
      const result = await onWriteConfig(values);
      setStatus(result.message);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Write failed");
    } finally {
      setWriting(false);
    }
  }, [onWriteConfig, values]);
  const resetKeys = useCallback(
    (keys) => {
      const next = { ...values };
      for (const k of keys) {
        next[k] = defaults[k];
      }
      onChange(next);
    },
    [defaults, onChange, values]
  );
  const sections = useMemo(() => {
    const out = [];
    let current2 = null;
    const ensureCurrent = () => {
      if (!current2) {
        current2 = { title: "Parameters", children: [], keys: [] };
        out.push(current2);
      }
      return current2;
    };
    const rootValues = values;
    const setRootValues = (next) => onChange(next);
    for (const field of fields) {
      if (field.type === "section") {
        current2 = { title: field.title, children: [], keys: [] };
        out.push(current2);
        continue;
      }
      const rendered = renderPanelField(field, {
        values: rootValues,
        setValues: setRootValues,
        rootValues,
        setRootValues,
        actionHandlers,
        onCollectionSelect: onSelect
      });
      if (!rendered) continue;
      const group = ensureCurrent();
      group.children.push(
        /* @__PURE__ */ jsx("div", { className: "panel-field", children: rendered.node }, rendered.reactKey)
      );
      if ("key" in field) group.keys.push(field.key);
    }
    return out;
  }, [actionHandlers, fields, onChange, onSelect, values]);
  const resolvedPeek = peek ?? !inline;
  return /* @__PURE__ */ jsx(
    FloatingPanel,
    {
      side,
      collapsed: !open,
      onToggle: onClose,
      onOpen,
      title,
      titleSlot,
      defaultTheme,
      themeStorageKey,
      showThemeToggle,
      container: container2,
      inline,
      peek: resolvedPeek,
      children: /* @__PURE__ */ jsxs("div", { className: "panel-fields", children: [
        showAnimation ? /* @__PURE__ */ jsx(ControlAnimation, {}) : null,
        prompts.length > 0 ? /* @__PURE__ */ jsx(ControlQuickActions, { prompts, shaderName: title }) : null,
        shortcutHint ? /* @__PURE__ */ jsxs("div", { className: "panel-shortcut-hint", children: [
          /* @__PURE__ */ jsx("kbd", { children: "\u2318\u2325D" }),
          " to toggle \xB7 ",
          /* @__PURE__ */ jsx("kbd", { children: "\u2318\u21E7`" }),
          " / ",
          /* @__PURE__ */ jsx("kbd", { children: "\u2318\u21E7D" }),
          " also work"
        ] }) : null,
        sections.map((section) => /* @__PURE__ */ jsx(
          ControlSection,
          {
            title: section.title,
            open: sectionOpen[section.title] ?? true,
            onOpenChange: (open2) => setSectionOpenState(section.title, open2),
            onReset: section.keys.length > 0 ? () => resetKeys(section.keys) : void 0,
            children: section.children
          },
          section.title
        )),
        /* @__PURE__ */ jsxs("div", { className: "panel-actions", children: [
          showExport ? /* @__PURE__ */ jsx(ControlExport, { name: title }) : null,
          /* @__PURE__ */ jsx("button", { type: "button", onClick: resetAll, className: "panel-action-btn", children: "Reset to defaults" }),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: handleCopy, className: "panel-action-btn", children: "Copy JSON" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => {
                setPasteOpen((v) => !v);
                setPasteError(null);
              },
              className: "panel-action-btn",
              "aria-expanded": pasteOpen,
              children: pasteOpen ? "Cancel paste" : "Paste JSON"
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "panel-collapse",
              "data-panel-open": persistKey && isModified ? "true" : "false",
              "aria-hidden": !(persistKey && isModified),
              children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsxs("div", { className: "panel-saved-indicator", "aria-live": "polite", children: [
                /* @__PURE__ */ jsx("span", { className: "panel-saved-dot" }),
                " Edits saved locally"
              ] }) })
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "panel-collapse",
              "data-panel-open": pasteOpen ? "true" : "false",
              "aria-hidden": !pasteOpen,
              children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsxs("div", { className: "panel-paste", children: [
                /* @__PURE__ */ jsx(
                  "textarea",
                  {
                    ref: pasteTextareaRef,
                    className: "panel-paste-textarea",
                    value: pasteText,
                    onChange: (e) => {
                      setPasteText(e.target.value);
                      if (pasteError) setPasteError(null);
                    },
                    placeholder: '{ "speed": 1.0, "bgColor": "#ff0000" }',
                    spellCheck: false,
                    rows: 5
                  }
                ),
                pasteError ? /* @__PURE__ */ jsx("div", { className: "panel-paste-error", children: pasteError }) : null,
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: handleApplyPaste,
                    disabled: pasteText.trim().length === 0,
                    className: "panel-action-btn",
                    children: "Apply"
                  }
                )
              ] }) })
            }
          ),
          onWriteConfig ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: writing,
              onClick: () => void handleWrite(),
              className: "panel-action-btn",
              children: writing ? "Writing\u2026" : writeLabel
            }
          ) : null,
          status ? /* @__PURE__ */ jsx("div", { className: "panel-status", children: status }) : null
        ] })
      ] })
    }
  );
}

// src/store.ts
var registrations = /* @__PURE__ */ new Map();
var activeLeftId = null;
var activeRightId = null;
var lastRegisteredId = null;
var listeners2 = /* @__PURE__ */ new Set();
var snapshotRevision = 0;
function registrationSide(reg) {
  return reg.side ?? "right";
}
function notify2() {
  snapshotRevision += 1;
  for (const listener of listeners2) listener();
}
function promoteActiveForSide(side) {
  const remaining = Array.from(registrations.values()).filter(
    (reg) => registrationSide(reg) === side
  );
  const nextId = remaining.length ? remaining[remaining.length - 1].id : null;
  if (side === "left") activeLeftId = nextId;
  else activeRightId = nextId;
}
function registerPanel(next) {
  if (next === null) {
    if (lastRegisteredId !== null) {
      unregisterPanel(lastRegisteredId);
    }
    return () => {
    };
  }
  const reg = next;
  const side = registrationSide(reg);
  registrations.set(reg.id, reg);
  lastRegisteredId = reg.id;
  if (side === "left") {
    if (activeLeftId === null || !registrations.has(activeLeftId)) {
      activeLeftId = reg.id;
    }
  } else if (activeRightId === null || !registrations.has(activeRightId)) {
    activeRightId = reg.id;
  }
  notify2();
  return () => unregisterPanel(reg.id);
}
function unregisterPanel(id) {
  const reg = registrations.get(id);
  const had = registrations.delete(id);
  if (!had || !reg) return;
  if (lastRegisteredId === id) lastRegisteredId = null;
  const side = registrationSide(reg);
  if (side === "left" && activeLeftId === id) promoteActiveForSide("left");
  if (side === "right" && activeRightId === id) promoteActiveForSide("right");
  notify2();
}
function setActivePanel(id) {
  const reg = registrations.get(id);
  if (!reg) return;
  const side = registrationSide(reg);
  if (side === "left") {
    if (activeLeftId === id) return;
    activeLeftId = id;
  } else {
    if (activeRightId === id) return;
    activeRightId = id;
  }
  notify2();
}
function getActivePanelId() {
  return activeRightId ?? activeLeftId;
}
function getActivePanelIdForSide(side) {
  return side === "left" ? activeLeftId : activeRightId;
}
function getActivePanel() {
  if (activeRightId) return registrations.get(activeRightId) ?? null;
  if (activeLeftId) return registrations.get(activeLeftId) ?? null;
  return null;
}
function getActivePanelForSide(side) {
  const id = getActivePanelIdForSide(side);
  return id ? registrations.get(id) ?? null : null;
}
function getPanelRegistrations() {
  return registrations;
}
function getPanelRegistrationsForSide(side) {
  return Array.from(registrations.values()).filter(
    (reg) => registrationSide(reg) === side
  );
}
function getPanelRevision() {
  return snapshotRevision;
}
function getPanelRegistration() {
  return getActivePanel();
}
function subscribePanelRegistration(listener) {
  listeners2.add(listener);
  return () => {
    listeners2.delete(listener);
  };
}
var PANEL_TOGGLE_EVENT = "cf-shader-dev-toggle";
var PANEL_OPEN_KEY = "cf-accent-shader-dev-open";
var PANEL_OPEN_LEFT_KEY = "cf-accent-shader-dev-open-left";
function openKeyForSide(side) {
  return side === "left" ? PANEL_OPEN_LEFT_KEY : PANEL_OPEN_KEY;
}
function readPanelOpenFlag(side = "right") {
  try {
    return sessionStorage.getItem(openKeyForSide(side)) === "true";
  } catch {
    return false;
  }
}
function writePanelOpenFlag(open, side = "right") {
  try {
    sessionStorage.setItem(openKeyForSide(side), open ? "true" : "false");
  } catch {
  }
}
function initPanelOpenFlag(defaultOpen, side = "right") {
  try {
    const key = openKeyForSide(side);
    const raw = sessionStorage.getItem(key);
    if (raw === null) {
      sessionStorage.setItem(key, defaultOpen ? "true" : "false");
      return defaultOpen;
    }
    return raw === "true";
  } catch {
    return defaultOpen;
  }
}
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target.isContentEditable;
}
function isKeyD(e) {
  return e.key === "d" || e.key === "D" || e.code === "KeyD";
}
function usePanelShortcut(onToggle, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !isKeyD(e)) return;
      const primary = e.shiftKey && !e.altKey;
      const fallback = e.altKey && !e.shiftKey;
      if (!primary && !fallback) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onToggle();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, onToggle]);
}
function dispatchPanelToggle(side = "right") {
  writePanelOpenFlag(!readPanelOpenFlag(side), side);
  window.dispatchEvent(new CustomEvent(PANEL_TOGGLE_EVENT, { detail: { side } }));
}

// src/hooks/keyboard.ts
function isEditableTarget2(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target.isContentEditable;
}
function matchPanelShortcut(e) {
  if (isEditableTarget2(e.target)) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (!e.shiftKey && e.altKey && e.code === "KeyD") {
    return true;
  }
  if (e.shiftKey && !e.altKey && (e.key === "`" || e.key === "~" || e.code === "Backquote")) {
    return true;
  }
  if (e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
    return true;
  }
  return false;
}
var keyboardInstalled = false;
function handlePanelShortcutKeydown(e) {
  if (!matchPanelShortcut(e)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  dispatchPanelToggle();
}
function installPanelKeyboard() {
  if (typeof document === "undefined") return () => {
  };
  if (keyboardInstalled) return () => {
  };
  keyboardInstalled = true;
  const onKeyDown = (e) => handlePanelShortcutKeydown(e);
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    keyboardInstalled = false;
  };
}
function subscribeSideOpen(side, listener) {
  const onToggle = () => listener();
  window.addEventListener(PANEL_TOGGLE_EVENT, onToggle);
  return () => window.removeEventListener(PANEL_TOGGLE_EVENT, onToggle);
}
function getSideOpenSnapshot(side) {
  return readPanelOpenFlag(side);
}
function useSideOpen(side) {
  const subscribe = useCallback(
    (listener) => subscribeSideOpen(side, listener),
    [side]
  );
  return useSyncExternalStore(
    subscribe,
    () => getSideOpenSnapshot(side),
    () => false
  );
}
var primaryClaimed = false;
function PanelRoot({
  emptyMessage = "No shader registered on this page.",
  defaultTheme,
  themeStorageKey,
  defaultLeftOpen = false,
  defaultRightOpen,
  showThemeToggle = true
} = {}) {
  const [isPrimary, setIsPrimary] = useState(false);
  useEffect(() => {
    if (primaryClaimed) return;
    primaryClaimed = true;
    setIsPrimary(true);
    initPanelOpenFlag(defaultLeftOpen, "left");
    if (defaultRightOpen !== void 0) {
      initPanelOpenFlag(defaultRightOpen, "right");
    }
    return () => {
      primaryClaimed = false;
    };
  }, [defaultLeftOpen, defaultRightOpen]);
  useInjectPanelStyles();
  const theme = usePanelTheme(defaultTheme);
  const leftOpen = useSideOpen("left");
  const rightOpen = useSideOpen("right");
  useSyncExternalStore(
    subscribePanelRegistration,
    getPanelRevision,
    () => 0
  );
  const leftRegistration = getActivePanelForSide("left");
  const rightRegistration = getActivePanelForSide("right");
  const leftRegistrations = getPanelRegistrationsForSide("left");
  const rightRegistrations = getPanelRegistrationsForSide("right");
  useEffect(() => installPanelKeyboard(), []);
  const setSideOpen = useCallback((side, next) => {
    writePanelOpenFlag(next, side);
    window.dispatchEvent(new CustomEvent(PANEL_TOGGLE_EVENT, { detail: { side } }));
  }, []);
  if (!isPrimary) return null;
  const hasAnyRegistration = leftRegistration ?? rightRegistration;
  const anyOpen = leftOpen || rightOpen;
  if (!hasAnyRegistration) {
    return anyOpen ? /* @__PURE__ */ jsxs("div", { "data-panel": "", "data-panel-theme": theme, className: "panel-empty", children: [
      emptyMessage,
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-empty-close",
          onClick: () => {
            setSideOpen("left", false);
            setSideOpen("right", false);
          },
          children: "Close"
        }
      )
    ] }) : null;
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    leftRegistration ? /* @__PURE__ */ jsx(
      RegisteredSidePanel,
      {
        side: "left",
        registration: leftRegistration,
        activeId: getActivePanelIdForSide("left"),
        allRegistrations: leftRegistrations,
        open: leftOpen,
        onClose: () => setSideOpen("left", false),
        onOpen: () => setSideOpen("left", true),
        defaultTheme,
        themeStorageKey,
        showThemeToggle
      }
    ) : null,
    rightRegistration ? /* @__PURE__ */ jsx(
      RegisteredSidePanel,
      {
        side: "right",
        registration: rightRegistration,
        activeId: getActivePanelIdForSide("right"),
        allRegistrations: rightRegistrations,
        open: rightOpen,
        onClose: () => setSideOpen("right", false),
        onOpen: () => setSideOpen("right", true),
        defaultTheme,
        themeStorageKey,
        showThemeToggle: false
      }
    ) : null
  ] });
}
function RegisteredSidePanel({
  side,
  registration,
  activeId,
  allRegistrations,
  open,
  onClose,
  onOpen,
  defaultTheme,
  themeStorageKey,
  showThemeToggle
}) {
  const switcher = allRegistrations.length > 1 ? /* @__PURE__ */ jsx(
    ShaderSwitcher,
    {
      activeId,
      registrations: allRegistrations,
      onSelect: setActivePanel
    }
  ) : null;
  return /* @__PURE__ */ jsx(
    Panel,
    {
      id: registration.id,
      side,
      title: registration.title,
      titleSlot: switcher,
      open,
      onClose,
      onOpen,
      values: registration.values,
      defaults: registration.defaults,
      fields: registration.fields,
      onChange: registration.onChange,
      onWriteConfig: registration.onWriteConfig,
      writeLabel: registration.writeLabel,
      prompts: registration.prompts,
      persist: registration.persist,
      defaultTheme,
      themeStorageKey,
      showThemeToggle,
      actionHandlers: registration.actionHandlers
    }
  );
}
function ShaderSwitcher({
  activeId,
  registrations: registrations2,
  onSelect
}) {
  return /* @__PURE__ */ jsx(
    "select",
    {
      className: "panel-switcher",
      value: activeId ?? "",
      onChange: (e) => onSelect(e.target.value),
      "aria-label": "Active shader",
      children: registrations2.map((reg) => /* @__PURE__ */ jsx("option", { value: reg.id, children: reg.title }, reg.id))
    }
  );
}

// src/constants.ts
var TOOL_PANEL_WIDTH = 280;
var TOOL_PANEL_INSET = 16;
var TOOL_PANEL_FULL = TOOL_PANEL_WIDTH + TOOL_PANEL_INSET;
function ToolShell({
  children,
  topBar,
  leftPanel,
  rightPanel,
  leftOpen = true,
  rightOpen = true,
  onLeftOpenChange,
  onRightOpenChange,
  uiVisible = true,
  onUiVisibleChange,
  showPanelToggles = true,
  showEyeToggle = true,
  className
}) {
  useInjectPanelStyles();
  const toggleLeft = useCallback(() => {
    onLeftOpenChange?.(!leftOpen);
  }, [leftOpen, onLeftOpenChange]);
  const toggleRight = useCallback(() => {
    onRightOpenChange?.(!rightOpen);
  }, [rightOpen, onRightOpenChange]);
  const toggleUi = useCallback(() => {
    onUiVisibleChange?.(!uiVisible);
  }, [uiVisible, onUiVisibleChange]);
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-tool-shell", className), children: [
    /* @__PURE__ */ jsx("div", { className: "panel-tool-viewport", children }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "panel-tool-overlay",
        "data-panel-ui-visible": uiVisible ? "true" : "false",
        children: [
          topBar ? /* @__PURE__ */ jsx(
            "div",
            {
              className: "panel-tool-topbar",
              style: {
                paddingLeft: leftOpen ? TOOL_PANEL_FULL + 8 : 20,
                paddingRight: rightOpen ? TOOL_PANEL_FULL + 8 : 20
              },
              children: topBar
            }
          ) : null,
          /* @__PURE__ */ jsxs("div", { className: "panel-tool-panels", children: [
            leftPanel,
            rightPanel
          ] }),
          showPanelToggles && leftPanel && onLeftOpenChange ? /* @__PURE__ */ jsx(
            PanelToggleButton,
            {
              side: "left",
              open: leftOpen,
              onToggle: toggleLeft
            }
          ) : null,
          showPanelToggles && rightPanel && onRightOpenChange ? /* @__PURE__ */ jsx(
            PanelToggleButton,
            {
              side: "right",
              open: rightOpen,
              onToggle: toggleRight
            }
          ) : null,
          showEyeToggle && onUiVisibleChange ? /* @__PURE__ */ jsx(EyeToggle, { visible: uiVisible, onToggle: toggleUi }) : null
        ]
      }
    )
  ] });
}
function PanelToggleButton({
  side,
  open,
  onToggle
}) {
  const isLeft = side === "left";
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: onToggle,
      className: "panel-panel-toggle",
      "data-panel-side": side,
      style: {
        [side]: open ? TOOL_PANEL_FULL + 4 : TOOL_PANEL_INSET
      },
      "aria-label": open ? `Collapse ${side} panel` : `Expand ${side} panel`,
      children: /* @__PURE__ */ jsx(
        ChevronIcon,
        {
          direction: isLeft ? open ? "left" : "right" : open ? "right" : "left"
        }
      )
    }
  );
}
function EyeToggle({ visible, onToggle }) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: onToggle,
      className: "panel-eye-toggle",
      "data-panel-visible": visible ? "true" : "false",
      title: visible ? "Hide UI" : "Show UI",
      "aria-label": visible ? "Hide UI" : "Show UI",
      children: visible ? /* @__PURE__ */ jsx(EyeOpenIcon, {}) : /* @__PURE__ */ jsx(EyeClosedIcon, {})
    }
  );
}
function ChevronIcon({ direction }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-panel-toggle-icon",
      "data-panel-direction": direction,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: direction === "left" ? /* @__PURE__ */ jsx("path", { d: "M15 18l-6-6 6-6" }) : /* @__PURE__ */ jsx("path", { d: "M9 18l6-6-6-6" })
    }
  );
}
function EyeOpenIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
        /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" })
      ]
    }
  );
}
function EyeClosedIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" }),
        /* @__PURE__ */ jsx("path", { d: "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" }),
        /* @__PURE__ */ jsx("path", { d: "M1 1l22 22" }),
        /* @__PURE__ */ jsx("path", { d: "M14.12 14.12a3 3 0 1 1-4.24-4.24" })
      ]
    }
  );
}
function ToolPanel({
  side,
  title,
  open,
  onClose,
  onOpen,
  titleSlot,
  children,
  className,
  defaultTheme,
  themeStorageKey,
  showThemeToggle = false,
  container: container2,
  inline = true,
  peek
}) {
  return /* @__PURE__ */ jsx(
    FloatingPanel,
    {
      side,
      collapsed: !open,
      onToggle: onClose,
      onOpen,
      title,
      titleSlot,
      className,
      defaultTheme,
      themeStorageKey,
      showThemeToggle,
      container: container2,
      inline,
      peek,
      children
    }
  );
}
var PanelToolPanel = ToolPanel;

// src/types.ts
function isPanelSection(field) {
  return field.type === "section";
}
var Root = PanelRoot;
var root = null;
var container = null;
var refCount = 0;
var mountedTheme;
function mountPanelOverlay(defaultTheme, defaultOpen) {
  if (typeof document === "undefined") return;
  refCount += 1;
  if (root) return;
  if (defaultOpen !== void 0) initPanelOpenFlag(defaultOpen, "right");
  initPanelOpenFlag(false, "left");
  mountedTheme = defaultTheme;
  container = document.createElement("div");
  container.setAttribute("data-shader-dev-overlay", "");
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(createElement(Root, { defaultTheme: mountedTheme }));
}
function unmountPanelOverlay() {
  if (typeof document === "undefined") return;
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  const toUnmount = root;
  const toRemove = container;
  root = null;
  container = null;
  queueMicrotask(() => {
    toUnmount?.unmount();
    toRemove?.remove();
  });
}

// src/hooks/use-panel.ts
function usePanel(options) {
  const {
    id,
    defaults,
    persist,
    autoMount = true,
    defaultTheme,
    defaultOpen
  } = options;
  const [values, setValues] = useState(
    () => persist === false ? { ...defaults } : loadPersistedPanelValues(id, defaults)
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useLayoutEffect(() => {
    const o = optionsRef.current;
    registerPanel({
      ...o,
      values,
      onChange: setValues
    });
  });
  useEffect(() => {
    if (autoMount) mountPanelOverlay(defaultTheme, defaultOpen);
    return () => {
      unregisterPanel(optionsRef.current.id);
      if (autoMount) unmountPanelOverlay();
    };
  }, []);
  return [values, setValues];
}
function ControlActionGroup({
  children,
  className
}) {
  return /* @__PURE__ */ jsx("div", { className: cn("panel-action-group", className), children });
}
function ControlDisclosure({
  title,
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
  dimmed = false,
  highlighted = false,
  onMouseEnter,
  onMouseLeave
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== void 0;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = (next) => {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn("panel-disclosure", className),
      "data-panel-open": open ? "true" : "false",
      "data-panel-dimmed": dimmed ? "true" : "false",
      "data-panel-highlight": highlighted ? "true" : "false",
      onMouseEnter,
      onMouseLeave,
      children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: "panel-disclosure-toggle",
            onClick: () => setOpen(!open),
            "aria-expanded": open,
            children: [
              /* @__PURE__ */ jsx("span", { className: "panel-disclosure-label", children: title }),
              /* @__PURE__ */ jsx(CaretIcon4, {})
            ]
          }
        ),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "panel-collapse",
            "data-panel-open": open ? "true" : "false",
            "aria-hidden": !open,
            children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-disclosure-body", children }) })
          }
        )
      ]
    }
  );
}
function CaretIcon4() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-disclosure-caret",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M19 9l-7 7-7-7" })
    }
  );
}
function ControlHint({ children, className }) {
  return /* @__PURE__ */ jsx("p", { className: cn("panel-hint", className), children });
}
function ControlSearchField({
  label,
  value,
  onChange,
  onSearch,
  placeholder,
  searching = false,
  error,
  searchLabel = "Search",
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-search", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-search-label", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "panel-search-row", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value,
          placeholder,
          onChange: (event) => onChange(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSearch();
            }
          },
          className: "panel-search-input",
          "aria-label": label
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-search-btn",
          onClick: onSearch,
          disabled: searching,
          children: searching ? "\u2026" : searchLabel
        }
      )
    ] }),
    error ? /* @__PURE__ */ jsx("div", { className: "panel-search-error", children: error }) : null
  ] });
}
function ControlTextInput({
  label,
  value,
  onChange,
  placeholder,
  layout = "stacked",
  monospace = false,
  className,
  onKeyDown
}) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn("panel-text", className),
      "data-panel-layout": layout,
      children: [
        /* @__PURE__ */ jsx("span", { className: "panel-text-label", children: label }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            value,
            placeholder,
            onChange: (event) => onChange(event.target.value),
            onKeyDown,
            className: "panel-text-input",
            "data-panel-mono": monospace ? "true" : "false",
            "aria-label": label
          }
        )
      ]
    }
  );
}
function ControlTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-textarea", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-textarea-label", children: label }),
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value,
        placeholder,
        rows,
        onChange: (event) => onChange(event.target.value),
        className: "panel-textarea-input",
        "aria-label": label
      }
    )
  ] });
}

export { ControlAction, ControlActionGroup, ControlAnimation, ControlCollection, ControlColorInput, ControlDisclosure, ControlHint, ControlImageInput, ControlOptionList, ControlPath, ControlPresets, ControlReadout, ControlReference, ControlSearchField, ControlSection, ControlSelect, ControlSlider, ControlTextInput, ControlTextarea, ControlThemeToggle, ControlToggle, ControlToggleGroup, ControlVec2, EyeToggle, FloatingPanel, PANEL_ANIMATION_STEP, PANEL_CSS, PANEL_STYLE_ID, PANEL_THEME_STORAGE_KEY, PANEL_TOGGLE_EVENT, Panel, PanelRoot, PanelThemeProvider, PanelToggleButton, PanelToolPanel, TOOL_PANEL_FULL, TOOL_PANEL_INSET, TOOL_PANEL_WIDTH, ToolPanel, ToolShell, advancePanelAnimationDelta, applyPanelTheme, clearPersistedPanelSections, clearPersistedPanelValues, createOverlayProjector, dispatchPanelToggle, embedPngDpi, getActivePanel, getActivePanelForSide, getActivePanelId, getActivePanelIdForSide, getPanelAnimationRevision, getPanelAnimationSnapshot, getPanelAnimationTime, getPanelRegistration, getPanelRegistrations, getPanelRegistrationsForSide, getPanelRevision, getShaderCapture, getShaderGifExport, getShaderRecordCanvas, getShaderRecordFrame, getShaderRecordPrepare, getShaderVideoExport, handlePanelShortcutKeydown, hasPersistedPanelValues, initPanelAnimationClock, installPanelKeyboard, isPanelSection, loadPersistedPanelSections, loadPersistedPanelValues, matchPanelShortcut, pausePanelAnimation, persistPanelSections, persistPanelValues, playPanelAnimation, printMaxEdgePx, readPanelOpenFlag, registerPanel, registerShaderCapture, registerShaderGifExport, registerShaderRecordCanvas, registerShaderRecordFrame, registerShaderRecordPrepare, registerShaderVideoExport, resetPanelAnimation, setActivePanel, setPanelAnimationRate, setPanelAnimationTime, setShaderRecording, stepPanelAnimationBackward, stepPanelAnimationForward, subscribePanelAnimation, subscribePanelRegistration, subscribeShaderCapture, subscribeShaderRecording, togglePanelAnimation, unregisterPanel, usePanel, usePanelShortcut, usePanelTheme, usePanelThemeContext, writePanelOpenFlag };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
