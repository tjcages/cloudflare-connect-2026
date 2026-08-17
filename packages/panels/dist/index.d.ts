import { R as RendererBinding, O as OverlayProjectorOptions, a as OverlayProjector, P as PanelTheme, b as PanelSide, c as PanelField, d as PanelPrompt, e as PanelSelectOption, f as PanelCollectionField, g as PanelCollectionItem, h as PanelReferenceField } from './use-panel-zmCghCIp.js';
export { i as OverlayAnchor, j as PANEL_THEME_STORAGE_KEY, k as PanelActionField, l as PanelColorField, m as PanelImageField, n as PanelPathField, o as PanelPresetOption, p as PanelPresetsField, q as PanelRegistration, r as PanelSectionField, s as PanelSelectField, t as PanelSliderField, u as PanelState, v as PanelThemeProvider, w as PanelToggleField, x as PanelToggleGroupField, y as PanelToggleGroupOption, z as PanelVec2Field, A as PanelWriteResult, B as ProjectedPoint, U as UsePanelOptions, V as Vec3, C as applyPanelTheme, D as getActivePanel, E as getActivePanelForSide, F as getActivePanelId, G as getActivePanelIdForSide, H as getPanelRegistration, I as getPanelRegistrations, J as getPanelRegistrationsForSide, K as getPanelRevision, L as isPanelSection, M as registerPanel, N as setActivePanel, Q as subscribePanelRegistration, S as unregisterPanel, T as usePanel, W as usePanelTheme, X as usePanelThemeContext } from './use-panel-zmCghCIp.js';
import * as react from 'react';
import { ReactNode } from 'react';

/**
 * `createOverlayProjector` (OFF-138) — renderer-agnostic core.
 *
 * Owns a single absolutely-positioned overlay layer (`pointer-events: none`)
 * meant to sit over the canvas. Register anchors; on each `binding.onFrame`
 * every anchor is `project()`ed and its node repositioned with
 * `transform: translate(...)`. Anchors that project `null` / `visible: false` /
 * behind-camera get `visibility: hidden`.
 *
 * Per the house perf rules this writes ONLY transform / visibility — never
 * top/left/width or any layout-thrashing property.
 *
 * This module imports nothing from `three` / `@react-three/fiber` — the whole
 * point of the binding indirection. The R3F binding lives in
 * `@tjcages/panels/shader`.
 */

/**
 * Create an overlay projector bound to a renderer.
 *
 * ```ts
 * const projector = createOverlayProjector(binding, { container })
 * const unregister = projector.register({ id, getWorld, node })
 * // …later
 * projector.destroy()
 * ```
 */
declare function createOverlayProjector(binding: RendererBinding, options?: OverlayProjectorOptions): OverlayProjector;

/**
 * localStorage persistence for shader dev panel values.
 *
 * Keyed by `panels:<id>` so each registered shader gets its own slot. Values
 * are merged with defaults on load so adding a new field doesn't wipe existing
 * edits.
 */
/**
 * Use as your `useState` initializer to hydrate from localStorage on mount:
 *
 * ```tsx
 * const [config, setConfig] = useState(() =>
 *   loadPersistedPanelValues("my-shader", DEFAULTS),
 * )
 * ```
 *
 * Unknown keys in the persisted blob are dropped; missing keys fall back to
 * defaults. Always returns a fresh object (no shared reference with defaults).
 */
declare function loadPersistedPanelValues<T extends Record<string, unknown>>(id: string, defaults: T): T;
declare function persistPanelValues<T extends Record<string, unknown>>(id: string, values: T): void;
declare function clearPersistedPanelValues(id: string): void;
declare function hasPersistedPanelValues(id: string): boolean;
/**
 * Load which panel sections are open. Missing keys default to open (`true`).
 */
declare function loadPersistedPanelSections(id: string): Record<string, boolean>;
declare function persistPanelSections(id: string, sections: Record<string, boolean>): void;
declare function clearPersistedPanelSections(id: string): void;

declare function FloatingPanel({ side, collapsed, onToggle, onOpen, title, titleSlot, children, className, defaultTheme, themeStorageKey, showThemeToggle, container, inline, peek, }: {
    side: "left" | "right";
    collapsed: boolean;
    /** Close (header ✕). */
    onToggle: () => void;
    /** Open — used by the edge sensor / peek preview. Defaults to `onToggle`. */
    onOpen?: () => void;
    title: string;
    /** Rendered next to the title — used by PanelRoot for the multi-shader switcher. */
    titleSlot?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    defaultTheme?: PanelTheme;
    /** sessionStorage key for the header theme toggle. */
    themeStorageKey?: string;
    /** Show the light/dark toggle in the panel header. Default true. */
    showThemeToggle?: boolean;
    /** Portal target. Defaults to `document.body`. Ignored when `inline` is true. */
    container?: HTMLElement | null;
    /** Render in-place (absolute positioning) instead of portaling to body. */
    inline?: boolean;
    /** Edge-hover peek preview while collapsed. Default true; disabled when inline. */
    peek?: boolean;
}): react.JSX.Element | null;

type PanelWriteResult = {
    ok: boolean;
    message: string;
};
declare function Panel<T extends Record<string, unknown>>({ id, title, titleSlot, side, open, onClose, onOpen, values, defaults, fields, onChange, onWriteConfig, writeLabel, shortcutHint, prompts, persist, defaultTheme, themeStorageKey, showThemeToggle, actionHandlers, container, inline, peek, showAnimation, showExport, onSelect, }: {
    /** Used as the localStorage key (`shader-dev:<id>`) when `persist` is true. */
    id?: string;
    title: string;
    /** Which side of the viewport the panel docks to. Default `"right"`. */
    side?: PanelSide;
    /** Rendered next to the title — used by PanelRoot for the multi-shader switcher. */
    titleSlot?: React.ReactNode;
    open: boolean;
    onClose: () => void;
    /** Open the panel — used by the edge-hover peek preview. */
    onOpen?: () => void;
    values: T;
    defaults: T;
    fields: PanelField<T>[];
    onChange: (next: T) => void;
    onWriteConfig?: (values: T) => Promise<PanelWriteResult>;
    writeLabel?: string;
    shortcutHint?: boolean;
    /** AI-prompt rail at the top of the panel. Pass `[]` to hide. */
    prompts?: ReadonlyArray<PanelPrompt>;
    /** Persist values to `localStorage["shader-dev:<id>"]`. Requires `id`. Default true. */
    persist?: boolean;
    defaultTheme?: PanelTheme;
    /** sessionStorage key for the header theme toggle. */
    themeStorageKey?: string;
    /** Show the light/dark toggle in the panel header. Default true. */
    showThemeToggle?: boolean;
    /** Handlers for `type: "action"` fields, keyed by `actionId`. */
    actionHandlers?: Record<string, () => void>;
    /** Portal target for the floating shell. Ignored when `inline` is true. */
    container?: HTMLElement | null;
    /** Render in-place instead of portaling to body. */
    inline?: boolean;
    /** Edge-hover peek preview while collapsed. Defaults to false when inline. */
    peek?: boolean;
    /** Show the shader animation clock block. Default true. */
    showAnimation?: boolean;
    /** Show canvas PNG/video export in the actions footer. Default true. */
    showExport?: boolean;
    /**
     * Fires with the open item's id (or null) of a `collection` field. The
     * collection key is the first argument. Used by canvas overlays to highlight
     * the selected item and vice-versa.
     */
    onSelect?: (collectionKey: string, id: string | null) => void;
}): react.JSX.Element;

/**
 * Mounts once in the app layout. Owns the keyboard shortcut + renders whichever
 * shader is currently active on each side. Shaders register themselves on
 * hydrate via `registerPanel({ id, title, side, values, defaults, fields, onChange })`.
 *
 * When 2+ shaders are registered on the same side, a switcher appears in that
 * panel's header.
 */
declare function PanelRoot({ emptyMessage, defaultTheme, themeStorageKey, defaultLeftOpen, defaultRightOpen, showThemeToggle, }?: {
    emptyMessage?: string;
    /** Initial theme when no user override + no `html.dark` are set. Falls back to OS preference if omitted. */
    defaultTheme?: PanelTheme;
    /** sessionStorage key for the header theme toggle. */
    themeStorageKey?: string;
    /** Initial open state for the left panel this session. Default false. */
    defaultLeftOpen?: boolean;
    /** Initial open state for the right panel. Defaults to closed unless seeded by `usePanel({ defaultOpen: true })`. */
    defaultRightOpen?: boolean;
    /** Show the sun/moon theme toggle in the left panel header. Default true. */
    showThemeToggle?: boolean;
}): react.JSX.Element | null;

type ToolShellProps = {
    /** Full-bleed viewport content (canvas, scene, etc.). */
    children: ReactNode;
    /** Optional top bar — receives dynamic padding when panels open. */
    topBar?: ReactNode;
    /** Left panel slot — typically `<ToolPanel side="left">` or `<Panel side="left">`. */
    leftPanel?: ReactNode;
    /** Right panel slot. */
    rightPanel?: ReactNode;
    leftOpen?: boolean;
    rightOpen?: boolean;
    onLeftOpenChange?: (open: boolean) => void;
    onRightOpenChange?: (open: boolean) => void;
    uiVisible?: boolean;
    onUiVisibleChange?: (visible: boolean) => void;
    /** Show chevron toggle buttons at the bottom of each side. Default true. */
    showPanelToggles?: boolean;
    /** Show the center eye toggle to hide/show all UI. Default true. */
    showEyeToggle?: boolean;
    className?: string;
};
/**
 * Generic playground layout — full-bleed viewport with left/right tool panels,
 * optional top bar, panel toggles, and eye toggle. The overlay uses
 * `pointer-events: none` so the viewport stays interactive underneath.
 */
declare function ToolShell({ children, topBar, leftPanel, rightPanel, leftOpen, rightOpen, onLeftOpenChange, onRightOpenChange, uiVisible, onUiVisibleChange, showPanelToggles, showEyeToggle, className, }: ToolShellProps): react.JSX.Element;
type PanelToggleButtonProps = {
    side: PanelSide;
    open: boolean;
    onToggle: () => void;
};
declare function PanelToggleButton({ side, open, onToggle, }: PanelToggleButtonProps): react.JSX.Element;
type EyeToggleProps = {
    visible: boolean;
    onToggle: () => void;
};
declare function EyeToggle({ visible, onToggle }: EyeToggleProps): react.JSX.Element;

type ToolPanelProps = {
    side: PanelSide;
    title: string;
    open: boolean;
    onClose: () => void;
    /** Open the panel — used by peek preview. Defaults to toggling closed→open via onClose inverse. */
    onOpen?: () => void;
    titleSlot?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    defaultTheme?: PanelTheme;
    themeStorageKey?: string;
    showThemeToggle?: boolean;
    /** Portal target. Ignored when `inline` is true (default in ToolShell). */
    container?: HTMLElement | null;
    /** Render in-place with absolute positioning. Default `true`. */
    inline?: boolean;
    peek?: boolean;
};
/**
 * Floating panel shell for custom tool content (non-schema panels).
 * Use for domain-specific editors like POI lists, scene trees, etc.
 */
declare function ToolPanel({ side, title, open, onClose, onOpen, titleSlot, children, className, defaultTheme, themeStorageKey, showThemeToggle, container, inline, peek, }: ToolPanelProps): react.JSX.Element;
/** Alias for ToolPanel — same component, shader-panel naming convention. */
declare const PanelToolPanel: typeof ToolPanel;

/** Floating panel width in pixels — matches `.panel-floating { width: 280px }`. */
declare const TOOL_PANEL_WIDTH = 280;
/** Gap between panel edge and viewport edge. */
declare const TOOL_PANEL_INSET = 16;
/** Panel width + inset — use for top-bar padding when a panel is open. */
declare const TOOL_PANEL_FULL: number;

/**
 * Optional high-resolution capture hook. The export panel has no handle on a
 * shader's renderer, so a shader page (e.g. an r3f `<Canvas>`) can register a
 * function that re-renders the current frame at an arbitrary pixel size and
 * returns it as a PNG blob. When none is registered, the panel falls back to
 * reading the visible canvas at screen resolution.
 *
 * `maxEdge` is the requested longest-edge pixel count; the registrant is
 * expected to clamp it to the GPU's real limit and preserve aspect ratio.
 */
type ShaderCaptureFn = (opts: {
    maxEdge: number;
}) => Promise<Blob>;
type ShaderGifExportOptions = {
    durationSec: number;
    fps: number;
    maxEdge: number;
    onProgress?: (progress: number) => void;
};
type ShaderGifExportFn = (opts: ShaderGifExportOptions) => Promise<Blob>;
/**
 * Host-owned video recording. The panel only starts/stops — capture + encode
 * live entirely in the host (same model as GIF export).
 */
type ShaderVideoSession = {
    stop: () => Promise<Blob>;
};
type ShaderVideoExportFn = () => Promise<ShaderVideoSession>;
type ShaderRecordCanvasGetter = () => HTMLCanvasElement | null;
type ShaderRecordPrepareFn = () => Promise<void>;
/**
 * Host paints one composite frame into the record canvas. Called by the
 * WebCodecs recorder immediately before each encode so capture stays in sync
 * with the live scene (same idea as GIF frame capture).
 */
type ShaderRecordFrameFn = () => void | Promise<void>;
type ShaderRecordingOptions = {
    /**
     * When true, the host should continuously composite (MediaRecorder /
     * captureStream). WebCodecs uses per-frame `registerShaderRecordFrame`
     * instead and should leave this false.
     */
    continuous?: boolean;
};
declare function registerShaderCapture(fn: ShaderCaptureFn | null): () => void;
declare function getShaderCapture(): ShaderCaptureFn | null;
declare function subscribeShaderCapture(listener: () => void): () => void;
declare function registerShaderRecordCanvas(getter: ShaderRecordCanvasGetter | null): () => void;
declare function getShaderRecordCanvas(): HTMLCanvasElement | null;
declare function registerShaderRecordPrepare(fn: ShaderRecordPrepareFn | null): () => void;
declare function getShaderRecordPrepare(): ShaderRecordPrepareFn | null;
declare function registerShaderGifExport(fn: ShaderGifExportFn | null): () => void;
declare function getShaderGifExport(): ShaderGifExportFn | null;
declare function registerShaderVideoExport(fn: ShaderVideoExportFn | null): () => void;
declare function getShaderVideoExport(): ShaderVideoExportFn | null;
declare function registerShaderRecordFrame(fn: ShaderRecordFrameFn | null): () => void;
declare function getShaderRecordFrame(): ShaderRecordFrameFn | null;
declare function subscribeShaderRecording(listener: (recording: boolean, opts: {
    continuous: boolean;
}) => void): () => void;
declare function setShaderRecording(active: boolean, opts?: ShaderRecordingOptions): void;

/** Default step size for frame-step buttons (≈ one 30 fps frame). */
declare const PANEL_ANIMATION_STEP: number;
type PanelAnimationSnapshot = {
    playing: boolean;
    /** Elapsed animation time in seconds. */
    time: number;
    /** Playback rate multiplier (1 = realtime). */
    rate: number;
};
declare function playPanelAnimation(): void;
declare function pausePanelAnimation(): void;
declare function togglePanelAnimation(): void;
declare function stepPanelAnimationForward(step?: number): void;
declare function stepPanelAnimationBackward(step?: number): void;
declare function resetPanelAnimation(): void;
declare function setPanelAnimationTime(next: number): void;
declare function setPanelAnimationRate(next: number): void;
declare function getPanelAnimationSnapshot(): PanelAnimationSnapshot;
declare function getPanelAnimationTime(): number;
declare function getPanelAnimationRevision(): number;
declare function subscribePanelAnimation(listener: () => void): () => void;
/**
 * Sample animation delta since the previous call. Intended for use inside
 * r3f `useFrame` (or any per-frame tick). Respects play/pause and manual
 * step/seek from the dev panel.
 */
declare function advancePanelAnimationDelta(previousTime: number): {
    time: number;
    delta: number;
};
/** Start the animation clock — called when the panel mounts. */
declare function initPanelAnimationClock(): void;

interface ControlAnimationProps {
    className?: string;
    /** Step size in seconds for the frame back/forward buttons. */
    step?: number;
}
declare function ControlAnimation({ className, step, }: ControlAnimationProps): react.JSX.Element;

declare const PANEL_TOGGLE_EVENT = "cf-shader-dev-toggle";
declare function readPanelOpenFlag(side?: PanelSide): boolean;
declare function writePanelOpenFlag(open: boolean, side?: PanelSide): void;
/**
 * Toggle shader dev UI.
 * - ⌘⌥D / Ctrl+Alt+D (primary)
 * - ⌘⇧D / Ctrl+Shift+D (Chrome on Mac may steal this for "Bookmark all tabs")
 */
declare function usePanelShortcut(onToggle: () => void, enabled?: boolean): void;
/** Dispatch from layout bridge; persists open state for late-hydrating shader islands. */
declare function dispatchPanelToggle(side?: PanelSide): void;

/** True when this keydown should toggle shader dev tools (document listener). */
declare function matchPanelShortcut(e: KeyboardEvent): boolean;
/** Idempotent — safe to call from layout root and inline boot script. */
declare function handlePanelShortcutKeydown(e: KeyboardEvent): void;
/** React backup when inline boot script is absent (e.g. some preview modes). */
declare function installPanelKeyboard(): () => void;

/**
 * Insert or replace a PNG pHYs chunk so viewers report the given DPI.
 * Returns the original blob unchanged when parsing fails.
 */
declare function embedPngDpi(blob: Blob, dpi: number): Promise<Blob>;
/** Longest-edge pixels for a print width/height at the given DPI. */
declare function printMaxEdgePx(widthInches: number, heightInches: number, dpi: number): number;

/**
 * Self-contained CSS for the shader-dev panel.
 *
 * Themes via CSS custom properties on `[data-panel]`. Consumers override
 * any variable in their own stylesheet to recolor without re-implementing.
 *
 * Class names are all `.panel-*` prefixed so they cannot collide with host app
 * styles even when the panel portals into `document.body`.
 */
declare const PANEL_STYLE_ID = "shader-dev-styles";
declare const PANEL_CSS = "\n[data-panel] {\n  --panel-bg: rgba(13, 13, 16, 0.95);\n  --panel-border: rgba(255, 255, 255, 0.16);\n  --panel-text: #ffffff;\n  --panel-text-muted: rgba(255, 255, 255, 0.72);\n  --panel-surface: rgba(255, 255, 255, 0.05);\n  --panel-surface-active: rgba(255, 255, 255, 0.15);\n  --panel-toggle-hover: var(--panel-surface-active);\n  --panel-surface-idle-fill: rgba(255, 255, 255, 0.11);\n  --panel-hash: rgba(255, 255, 255, 0.15);\n  --panel-handle: #ffffff;\n  --panel-label: rgba(255, 255, 255, 0.7);\n  --panel-label-active: #ffffff;\n  --panel-divider: rgba(255, 255, 255, 0.06);\n  --panel-muted-icon: rgba(255, 255, 255, 0.4);\n  --panel-swatch-border: rgba(255, 255, 255, 0.2);\n  --panel-kbd-bg: rgba(255, 255, 255, 0.1);\n  --panel-action-bg: rgba(255, 255, 255, 0.05);\n  --panel-action-bg-hover: rgba(255, 255, 255, 0.1);\n  --panel-action-text: rgba(255, 255, 255, 0.72);\n  --panel-action-text-hover: #ffffff;\n  --panel-danger: #f87171;\n  --panel-danger-hover: #fca5a5;\n  --panel-header-border: rgba(255, 255, 255, 0.096);\n  --panel-close-icon: rgba(255, 255, 255, 0.72);\n  --panel-close-icon-hover: #ffffff;\n  --panel-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);\n}\n\n[data-panel][data-panel-theme=\"light\"] {\n  --panel-bg: rgba(255, 255, 255, 0.95);\n  --panel-border: #d1d5db;\n  --panel-text: #111827;\n  --panel-text-muted: #4b5563;\n  --panel-surface: #f3f4f6;\n  --panel-surface-active: #d1d5db;\n  --panel-toggle-hover: rgba(17, 24, 39, 0.04);\n  --panel-surface-idle-fill: #e5e7eb;\n  --panel-hash: #d1d5db;\n  --panel-handle: #111827;\n  --panel-label: #374151;\n  --panel-label-active: #111827;\n  --panel-divider: #e5e7eb;\n  --panel-muted-icon: #9ca3af;\n  --panel-swatch-border: #d1d5db;\n  --panel-kbd-bg: #e5e7eb;\n  --panel-action-bg: #f3f4f6;\n  --panel-action-bg-hover: #e5e7eb;\n  --panel-action-text: #374151;\n  --panel-action-text-hover: #111827;\n  --panel-danger: #dc2626;\n  --panel-danger-hover: #b91c1c;\n  --panel-header-border: #e5e7eb;\n  --panel-close-icon: #6b7280;\n  --panel-close-icon-hover: #111827;\n}\n\n[data-panel],\n[data-panel] *,\n[data-panel] *::before,\n[data-panel] *::after {\n  box-sizing: border-box;\n}\n\n/* Chrome elements shouldn't be selectable \u2014 labels, titles, buttons. Only\n   inputs and the prompt code block opt back in via the override below. */\n[data-panel] {\n  -webkit-user-select: none;\n  user-select: none;\n}\n[data-panel] input,\n[data-panel] textarea,\n[data-panel] .panel-prompt-pre,\n[data-panel] .panel-paste-textarea,\n[data-panel] .panel-text-input,\n[data-panel] .panel-textarea-input,\n[data-panel] .panel-search-input {\n  -webkit-user-select: text;\n  user-select: text;\n}\n\n[data-panel] button:not([class]) {\n  background: transparent;\n  border: 0;\n  padding: 0;\n  margin: 0;\n  font-family: inherit;\n  /* Intentionally NOT inheriting font-size \u2014 leaves component classes free to\n     set their own without losing to specificity. */\n  color: inherit;\n  cursor: pointer;\n}\n\n/* All panel chrome buttons carry panel-* classes \u2014 zero host-app borders\n   (Tailwind preflight, browser defaults, etc.) before component styles apply. */\n[data-panel] button[class*=\"panel-\"] {\n  border: 0;\n  outline: none;\n  appearance: none;\n  -webkit-appearance: none;\n  box-shadow: none;\n}\n\n[data-panel] input,\n[data-panel] select,\n[data-panel] textarea {\n  font-family: inherit;\n  font-size: inherit;\n  font-weight: inherit;\n  line-height: inherit;\n  color: inherit;\n  border: 0;\n  outline: none;\n  appearance: none;\n  -webkit-appearance: none;\n  box-shadow: none;\n}\n\n[data-panel] input.panel-color-text {\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1;\n  color: var(--panel-label);\n}\n\n.panel-floating {\n  pointer-events: auto;\n  position: fixed;\n  top: 16px;\n  bottom: 16px;\n  z-index: 9999;\n  display: flex;\n  width: 280px;\n  flex-direction: column;\n  opacity: 1;\n  filter: blur(0);\n  transition-property: transform, opacity, filter;\n  transition-duration: 280ms, 200ms, 200ms;\n  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1), ease-in, ease-in;\n  -webkit-backdrop-filter: blur(12px);\n  backdrop-filter: blur(12px);\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n  -webkit-font-smoothing: antialiased;\n}\n.panel-floating[data-panel-side=\"left\"] { left: 16px; }\n.panel-floating[data-panel-side=\"right\"] { right: 16px; }\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-side=\"left\"] { transform: translateX(calc(-100% - 16px)); }\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-side=\"right\"] { transform: translateX(calc(100% + 16px)); }\n.panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) {\n  opacity: 0;\n  filter: blur(4px);\n  pointer-events: none;\n}\n\n/* Peek preview \u2014 a scaled-down sliver slides in when the viewport edge is\n   hovered while collapsed. Overrides the fully-hidden collapsed transform. */\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-peek=\"true\"] { cursor: pointer; }\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-peek=\"true\"][data-panel-side=\"right\"] {\n  transform: translateX(calc(100% - 56px)) scale(0.9);\n  transform-origin: right center;\n  opacity: 1;\n  filter: blur(0);\n  pointer-events: auto;\n}\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-peek=\"true\"][data-panel-side=\"left\"] {\n  transform: translateX(calc(-100% + 56px)) scale(0.9);\n  transform-origin: left center;\n  opacity: 1;\n  filter: blur(0);\n  pointer-events: auto;\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-floating { transition: none; }\n  .panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) {\n    opacity: 0;\n    filter: none;\n  }\n  .panel-panel,\n  .panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) .panel-panel {\n    transition: none;\n    opacity: 1;\n    transform: none;\n  }\n}\n\n.panel-panel {\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  overflow: hidden;\n  border-radius: 14px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  color: var(--panel-text);\n  box-shadow: var(--panel-shadow);\n  opacity: 1;\n  transform: translateY(0) scale(1);\n  transition-property: opacity, transform;\n  transition-duration: 220ms;\n  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) .panel-panel {\n  opacity: 0;\n  transform: translateY(-8px) scale(0.98);\n  transition-timing-function: ease-in;\n  transition-duration: 180ms;\n}\n\n/* Invisible hover/click strip pinned to the viewport edge \u2014 reveals the peek\n   (and reopens on click) while the panel is collapsed. */\n.panel-edge-sensor {\n  position: fixed;\n  top: 0;\n  bottom: 0;\n  width: 24px;\n  z-index: 9998;\n  cursor: pointer;\n}\n.panel-edge-sensor[data-panel-side=\"right\"] { right: 0; }\n.panel-edge-sensor[data-panel-side=\"left\"] { left: 0; }\n.panel-edge-sensor[data-panel-inline=\"true\"] { display: none; }\n\n/* Inline panels (ToolShell) use absolute positioning within the overlay. */\n.panel-floating[data-panel-inline=\"true\"] {\n  position: absolute;\n  z-index: 20;\n}\n\n/* Transparent click-catcher over the peeking panel \u2014 any click opens it fully\n   instead of hitting a control in the scaled-down preview. */\n.panel-peek-catch {\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  border-radius: 14px;\n  background: transparent;\n  cursor: pointer;\n}\n\n.panel-panel-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  border-bottom: 1px solid var(--panel-header-border);\n  padding: 10px 12px 6px 12px;\n}\n.panel-panel-title-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  flex: 1;\n}\n.panel-panel-title {\n  font-size: 15px;\n  font-weight: 600;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-panel-header-end {\n  display: flex;\n  flex-shrink: 0;\n  align-items: center;\n  gap: 4px;\n}\n/* Header variant of the toggle group \u2014 compact, icon-only, non-growing. */\n.panel-toggle-group.panel-theme-toggle {\n  width: auto;\n  padding: 0;\n}\n.panel-toggle-group.panel-theme-toggle .panel-toggle-group-track {\n  gap: 2px;\n  padding: 2px;\n}\n[data-panel] .panel-toggle-group.panel-theme-toggle .panel-toggle-group-btn {\n  flex: 0 0 auto;\n  width: 26px;\n  height: 26px;\n  padding: 0;\n}\n.panel-switcher {\n  appearance: none;\n  -webkit-appearance: none;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-surface);\n  color: var(--panel-text);\n  border-radius: 6px;\n  padding: 2px 22px 2px 8px;\n  font-size: 12px;\n  font-weight: 500;\n  line-height: 1.4;\n  cursor: pointer;\n  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);\n  background-position: calc(100% - 11px) 50%, calc(100% - 7px) 50%;\n  background-size: 4px 4px, 4px 4px;\n  background-repeat: no-repeat;\n  max-width: 110px;\n  text-overflow: ellipsis;\n  overflow: hidden;\n}\n.panel-switcher:focus { outline: 2px solid var(--panel-handle); outline-offset: 1px; }\n\n.panel-close-btn {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  border-radius: 4px;\n  color: var(--panel-close-icon);\n  transition-property: color, scale;\n  transition-duration: 150ms;\n  transition-timing-function: ease-out;\n}\n.panel-close-btn::before {\n  content: \"\";\n  position: absolute;\n  inset: -10px;\n}\n.panel-close-btn:active {\n  scale: 0.96;\n}\n.panel-close-btn:hover { color: var(--panel-close-icon-hover); }\n.panel-close-btn svg { width: 16px; height: 16px; }\n\n.panel-panel-body {\n  flex: 1;\n  overflow-y: auto;\n  padding: 10px 12px;\n  scrollbar-width: none;\n  -ms-overflow-style: none;\n}\n.panel-panel-body::-webkit-scrollbar { display: none; }\n\n.panel-fields {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding-bottom: 8px;\n}\n\n/* Animation transport \u2014 pinned at the top of the panel body. */\n.panel-animation {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-bottom: 10px;\n  margin-bottom: 2px;\n  border-bottom: 1px solid var(--panel-divider);\n}\n.panel-animation-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-animation-row {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n[data-panel] .panel-animation-btn {\n  flex: 0 0 auto;\n  width: 32px;\n  height: 32px;\n  border-radius: 8px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--panel-action-text);\n  background: var(--panel-action-bg);\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-animation-btn svg {\n  width: 14px;\n  height: 14px;\n}\n[data-panel] .panel-animation-btn:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-animation-btn-primary {\n  width: 36px;\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-animation-btn-primary:hover {\n  background: var(--panel-handle);\n  color: #ffffff;\n}\n[data-panel] .panel-animation-btn-reset {\n  margin-left: auto;\n}\n.panel-animation-time {\n  flex: 1;\n  min-width: 0;\n  padding: 0 6px;\n  font-family: inherit;\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n  color: var(--panel-text-muted);\n  text-align: center;\n}\n\n.panel-shortcut-hint {\n  font-size: 12px;\n  color: var(--panel-text-muted);\n}\n.panel-shortcut-hint kbd {\n  border-radius: 4px;\n  padding: 0 4px;\n  font-family: inherit;\n  background: var(--panel-kbd-bg);\n}\n\n.panel-actions {\n  margin-top: 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  border-top: 1px solid var(--panel-divider);\n  padding-top: 12px;\n}\n\n.panel-export-format-row {\n  display: flex;\n  gap: 6px;\n}\n.panel-export-format-row .panel-action-btn {\n  flex: 1;\n  min-width: 0;\n}\n\n/* Scoped under [data-panel] to beat the global button reset on\n   specificity \u2014 otherwise the always-on light gray fill loses. */\n[data-panel] .panel-action-btn {\n  width: 100%;\n  height: 36px;\n  border-radius: 8px;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  transition-property: background-color, color, scale;\n  transition-duration: 150ms;\n  transition-timing-function: ease-out;\n}\n[data-panel] .panel-action-btn:active:not(:disabled) {\n  scale: 0.96;\n}\n[data-panel] .panel-action-btn:hover:not(.panel-action-btn-primary):not(:disabled) {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }\n[data-panel] .panel-action-btn-primary {\n  background: var(--panel-handle);\n  color: var(--panel-bg);\n  border-color: transparent;\n}\n[data-panel] .panel-action-btn-primary:hover:not(:disabled) {\n  background: var(--panel-handle);\n  filter: brightness(1.08);\n  color: var(--panel-bg);\n}\n[data-panel] .panel-action-btn-destructive {\n  background: color-mix(in srgb, var(--panel-danger) 10%, var(--panel-action-bg));\n  color: var(--panel-danger);\n}\n[data-panel] .panel-action-btn-destructive:hover:not(:disabled) {\n  background: color-mix(in srgb, var(--panel-danger) 16%, var(--panel-action-bg-hover));\n  color: var(--panel-danger-hover);\n}\n\n.panel-action-group {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px;\n}\n.panel-action-group .panel-action-field {\n  min-width: 0;\n}\n.panel-action-group .panel-action-btn {\n  width: 100%;\n  padding-left: 8px;\n  padding-right: 8px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-action-field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.panel-status {\n  padding: 0 4px;\n  font-size: 12px;\n  color: var(--panel-text-muted);\n}\n\n/* Export group \u2014 pinned at the top of the actions block, separated from the\n   JSON/reset buttons by a hairline divider. */\n.panel-export {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-bottom: 12px;\n  margin-bottom: 4px;\n  border-bottom: 1px solid var(--panel-divider);\n}\n.panel-export-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-export-row {\n  display: flex;\n  gap: 6px;\n}\n.panel-export-row .panel-action-btn {\n  flex: 1;\n}\n.panel-export-hint {\n  font-size: 11px;\n  line-height: 1.35;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-export-gif {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 4px;\n  padding-top: 10px;\n  border-top: 1px solid var(--panel-divider);\n}\n.panel-export-gif-label {\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-export-gif-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px;\n  padding: 3px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n}\n[data-panel] .panel-export-gif-row .panel-export-res-btn {\n  flex: 1 1 0;\n  min-width: 0;\n}\n\n/* Segmented resolution selector for the hi-res PNG. */\n.panel-export-res-group {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.panel-export-res {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px;\n  padding: 3px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n}\n[data-panel] .panel-export-res-screen .panel-export-res-btn,\n[data-panel] .panel-export-res-print .panel-export-res-btn {\n  flex: 1 1 0;\n  min-width: 0;\n}\n[data-panel] .panel-export-res-btn {\n  min-width: 2.75rem;\n  height: 26px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  line-height: 1;\n  color: var(--panel-text-muted);\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-export-res-btn:hover {\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-export-res-active,\n[data-panel] .panel-export-res-active:hover {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-export-rec,\n[data-panel] .panel-export-rec:hover {\n  background: #e5484d;\n  color: #ffffff;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n.panel-export-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 999px;\n  background: #ffffff;\n  animation: panel-export-pulse 1s ease-in-out infinite;\n}\n@keyframes panel-export-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.25; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-export-dot { animation: none; }\n}\n\n/* Auto-height animation via CSS Grid: parent transitions\n   grid-template-rows between 0fr and 1fr, child clips overflow. */\n.panel-collapse {\n  display: grid;\n  grid-template-rows: 0fr;\n  overflow: hidden;\n  transition: grid-template-rows 280ms cubic-bezier(0.32, 0.72, 0, 1);\n}\n.panel-collapse[data-panel-open=\"true\"] {\n  grid-template-rows: 1fr;\n  overflow: visible;\n}\n.panel-collapse-inner {\n  /* Vertical clipping only \u2014 height animation still collapses, but horizontal\n     overshoot (slider overscroll spring, toggle row full-bleed hover) is not\n     cropped. inset(-16px 0) regressed toggle hovers (white side gutters). */\n  clip-path: inset(0 -9999px);\n  min-height: 0;\n  min-width: 0;\n  opacity: 0;\n  transition: opacity 200ms ease;\n}\n.panel-collapse[data-panel-open=\"true\"] > .panel-collapse-inner {\n  opacity: 1;\n  transition: opacity 200ms ease 80ms;\n}\n\n.panel-saved-indicator {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 4px 4px 2px;\n  font-size: 11px;\n  font-weight: 500;\n  color: var(--panel-text-muted);\n}\n.panel-saved-dot {\n  width: 6px;\n  height: 6px;\n  border-radius: 999px;\n  background: #22c55e;\n  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);\n  flex-shrink: 0;\n}\n\n.panel-paste {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 4px 0;\n}\n/* Scoped under [data-panel] to beat the global textarea reset on\n   specificity \u2014 otherwise the explicit small font-size loses. */\n[data-panel] .panel-paste-textarea {\n  width: 100%;\n  min-height: 96px;\n  resize: vertical;\n  padding: 8px 10px;\n  border-radius: 8px;\n  background: var(--panel-bg);\n  color: var(--panel-text);\n  border: 1px solid var(--panel-border);\n  font-family: inherit;\n  font-size: 10px;\n  line-height: 1.5;\n  outline: none;\n  transition: border-color 150ms ease;\n}\n[data-panel] .panel-paste-textarea:focus {\n  border-color: var(--panel-handle);\n}\n[data-panel] .panel-paste-textarea::placeholder {\n  color: var(--panel-muted-icon);\n}\n.panel-paste-error {\n  padding: 0 4px;\n  font-size: 11px;\n  color: #ef4444;\n}\n\n.panel-empty {\n  pointer-events: auto;\n  position: fixed;\n  top: 16px;\n  right: 16px;\n  z-index: 9998;\n  max-width: 280px;\n  border-radius: 8px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  color: var(--panel-text-muted);\n  padding: 12px;\n  font-size: 13px;\n  box-shadow: var(--panel-shadow);\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n}\n.panel-empty-close {\n  margin-top: 8px;\n  display: block;\n  width: 100%;\n  border-radius: 8px;\n  padding: 8px 12px;\n  background: var(--panel-action-bg);\n  color: var(--panel-text);\n  font-size: 13px;\n}\n.panel-empty-close:hover { background: var(--panel-action-bg-hover); }\n\n.panel-section {\n  border-top: 1px solid var(--panel-divider);\n}\n.panel-section:first-child { border-top: 0; }\n.panel-section-header {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  gap: 4px;\n  padding: 12px 0 8px;\n}\n.panel-section:first-child .panel-section-header { padding-top: 2px; }\n.panel-section-button {\n  display: flex;\n  flex: 1;\n  min-width: 0;\n  align-items: center;\n  height: 20px;\n  font-size: 10px;\n  font-weight: 600;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  text-align: left;\n}\n.panel-section-button:hover { color: var(--panel-label-active); }\n.panel-section-title {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-section-caret-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  border-radius: 4px;\n  color: var(--panel-muted-icon);\n  flex-shrink: 0;\n  transition: color 150ms ease, background-color 150ms ease;\n}\n.panel-section-caret-btn:hover { color: var(--panel-label-active); background: var(--panel-surface); }\n.panel-section-caret {\n  width: 12px;\n  height: 12px;\n  transition: transform 200ms ease;\n}\n.panel-section[data-panel-open=\"true\"] .panel-section-caret { transform: rotate(180deg); }\n.panel-section-reset {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  border-radius: 4px;\n  color: var(--panel-muted-icon);\n  opacity: 0;\n  transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease;\n  flex-shrink: 0;\n}\n.panel-section-reset svg { width: 12px; height: 12px; }\n.panel-section-header:hover .panel-section-reset,\n.panel-section-reset:focus-visible { opacity: 1; }\n.panel-section-reset:hover {\n  color: var(--panel-label-active);\n  background: var(--panel-surface);\n}\n.panel-section-children {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-bottom: 10px;\n  overflow: visible;\n}\n\n.panel-field {\n  min-width: 0;\n  overflow: visible;\n}\n\n.panel-field-description {\n  font-size: 10.5px;\n  line-height: 1.35;\n  color: var(--panel-label-muted);\n  padding: 4px 4px 2px;\n  letter-spacing: 0.01em;\n}\n\n[data-panel] .panel-slider {\n  position: relative;\n  height: 36px;\n  width: 100%;\n  margin: 0;\n  overflow: visible;\n  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n[data-panel] .panel-slider[data-panel-state=\"hover\"] { transform: scale(1.01); }\n[data-panel] .panel-slider[data-panel-state=\"drag\"] { transform: scale(1.018); }\n\n.panel-slider-overscroll {\n  position: absolute;\n  inset: 0;\n  transform: scaleX(var(--panel-os-scale, 1));\n  transform-origin: var(--panel-os-origin, 50% 50%);\n}\n.panel-slider-overscroll[data-panel-release=\"true\"] {\n  transition: transform 320ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-slider-overscroll[data-panel-release=\"true\"] { transition: none; }\n  [data-panel] .panel-slider { transition: none; }\n}\n\n.panel-slider-track {\n  position: absolute;\n  inset: 0;\n  cursor: pointer;\n  user-select: none;\n  overflow: hidden;\n  touch-action: none;\n  border-radius: 8px;\n  background: var(--panel-surface);\n}\n\n.panel-slider-hash-row {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n}\n.panel-slider-hash {\n  position: absolute;\n  top: 50%;\n  height: 8px;\n  width: 1px;\n  transform: translateY(-50%);\n  border-radius: 999px;\n  background: transparent;\n  transition: background-color 200ms ease;\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-hash,\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-hash { background: var(--panel-hash); }\n\n.panel-slider-fill {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  width: var(--panel-fill-pct, 0%);\n  pointer-events: none;\n  background: var(--panel-surface-idle-fill);\n  transition: background-color 150ms ease, width 220ms cubic-bezier(0.2, 0, 0, 1);\n}\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-fill {\n  transition: background-color 150ms ease, width 0ms;\n  background: var(--panel-surface-active);\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-fill { background: var(--panel-surface-active); }\n\n.panel-slider-handle {\n  position: absolute;\n  top: 50%;\n  height: 20px;\n  width: 3px;\n  left: var(--panel-handle-left, 0%);\n  border-radius: 999px;\n  pointer-events: none;\n  background: var(--panel-handle);\n  opacity: 0;\n  transform: translate(-1.5px, -50%) scaleY(1);\n  transform-origin: center center;\n  transition:\n    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    left 220ms cubic-bezier(0.2, 0, 0, 1);\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-handle { opacity: 0.5; }\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-handle {\n  opacity: 0.9;\n  transform: translate(-1.5px, -50%) scaleY(1.3);\n  transition:\n    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    left 0ms;\n}\n\n.panel-slider-label {\n  position: absolute;\n  left: 10px;\n  top: 50%;\n  transform: translateY(-50%);\n  pointer-events: none;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-slider-value {\n  position: absolute;\n  right: 10px;\n  top: 50%;\n  transform: translateY(-50%);\n  pointer-events: none;\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n  transition: color 150ms ease;\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-value,\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-value { color: var(--panel-label-active); }\n\n.panel-color {\n  display: flex;\n  height: 36px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  border-radius: 8px;\n  padding: 0 12px;\n  background: var(--panel-surface);\n}\n.panel-color-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-color-right {\n  position: relative;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.panel-color-text {\n  width: 7ch;\n  background: transparent;\n  border: 0;\n  outline: 0;\n  text-align: right;\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n  text-transform: uppercase;\n}\n.panel-color-swatch {\n  height: 20px;\n  width: 20px;\n  flex-shrink: 0;\n  border-radius: 4px;\n  border: 1px solid var(--panel-swatch-border);\n  transition: transform 150ms ease;\n}\n.panel-color-swatch:hover { transform: scale(1.1); }\n/* Sized + positioned over the swatch (not 0x0) so showPicker()/click() has a\n   real anchor rect \u2014 pickers anchor to the input's position. */\n.panel-color-native {\n  position: absolute;\n  right: 0;\n  top: 50%;\n  margin-top: -10px;\n  height: 20px;\n  width: 20px;\n  opacity: 0;\n  pointer-events: none;\n}\n\n.panel-path {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-path-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n.panel-path-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-path-head-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.panel-path-count {\n  font-size: 11px;\n  color: var(--panel-muted-icon);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n}\n[data-panel] .panel-path-clear {\n  font-size: 11px;\n  font-weight: 500;\n  padding: 3px 8px;\n  border-radius: 6px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  cursor: pointer;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-path-clear:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n.panel-path-pad {\n  display: block;\n  width: 100%;\n  aspect-ratio: 1;\n  border-radius: 8px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-surface);\n  touch-action: none;\n  cursor: crosshair;\n  overflow: visible;\n}\n.panel-path-bg {\n  fill: transparent;\n  cursor: crosshair;\n}\n.panel-path-grid {\n  stroke: var(--panel-divider);\n  stroke-width: 0.5;\n}\n.panel-path-frame {\n  fill: none;\n  stroke: var(--panel-border);\n  stroke-width: 0.5;\n}\n.panel-path-line {\n  fill: none;\n  stroke: var(--panel-handle);\n  stroke-width: 1;\n  stroke-linejoin: round;\n  stroke-linecap: round;\n  opacity: 0.55;\n}\n.panel-path-line-close {\n  stroke: var(--panel-handle);\n  stroke-width: 0.8;\n  stroke-dasharray: 2 2;\n  opacity: 0.3;\n}\n.panel-path-anchor circle {\n  fill: none;\n  stroke: var(--panel-handle);\n  stroke-width: 1;\n  opacity: 0.7;\n}\n.panel-path-anchor.is-draggable {\n  cursor: grab;\n}\n.panel-path-anchor.is-draggable .panel-path-point-hit {\n  cursor: grab;\n}\n.panel-path-anchor.is-draggable:active {\n  cursor: grabbing;\n}\n.panel-path-anchor.is-selected circle:not(.panel-path-point-hit) {\n  stroke-width: 1.4;\n  opacity: 1;\n}\n.panel-path-anchor .panel-path-anchor-dot {\n  fill: var(--panel-handle);\n  stroke: none;\n  opacity: 0.9;\n}\n.panel-path-point {\n  cursor: grab;\n}\n.panel-path-point:active {\n  cursor: grabbing;\n}\n.panel-path-point-hit {\n  fill: transparent;\n}\n.panel-path-point-ring {\n  fill: var(--panel-bg);\n  stroke: var(--panel-handle);\n  stroke-width: 1.2;\n  transition: r 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-path-point.is-selected .panel-path-point-ring {\n  fill: var(--panel-handle);\n}\n.panel-path-point-num {\n  fill: var(--panel-label);\n  font-size: 3.4px;\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  text-anchor: middle;\n  pointer-events: none;\n  user-select: none;\n}\n.panel-path-point.is-selected .panel-path-point-num {\n  fill: var(--panel-bg);\n}\n.panel-path-selected {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  font-size: 11px;\n  color: var(--panel-text-muted);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n}\n[data-panel] .panel-path-remove {\n  font-size: 11px;\n  font-weight: 500;\n  padding: 3px 8px;\n  border-radius: 6px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  cursor: pointer;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-path-remove:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n.panel-path-hint {\n  font-size: 10.5px;\n  color: var(--panel-muted-icon);\n  text-align: center;\n}\n\n.panel-image {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-image-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n.panel-image-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-image-upload {\n  font-size: 11px;\n  font-weight: 500;\n  padding: 3px 10px;\n  border-radius: 6px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  cursor: pointer;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n.panel-image-upload:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n.panel-image-frame {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  min-height: 48px;\n  border-radius: 8px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-surface);\n  overflow: hidden;\n  transition: border-color 150ms ease, background-color 150ms ease;\n}\n.panel-image-frame[data-panel-interactive=\"true\"] { cursor: pointer; }\n.panel-image-frame[data-panel-interactive=\"true\"]:hover,\n.panel-image-frame[data-panel-drag=\"true\"] {\n  border-color: var(--panel-handle);\n  background: var(--panel-surface-active);\n}\n.panel-image-preview {\n  display: block;\n  width: 75%;\n  height: auto;\n  border-radius: 4px;\n}\n.panel-image-empty {\n  font-size: 11px;\n  color: var(--panel-muted-icon);\n  padding: 14px 0;\n}\n.panel-image-native {\n  position: absolute;\n  height: 0;\n  width: 0;\n  opacity: 0;\n  pointer-events: none;\n}\n\n/* Scoped under [data-panel] so it beats the global button reset\n   (which zeroes padding/background). The negative margin + matching padding\n   full-bleeds the hover highlight ~8px past the label on each side, so the\n   label stays aligned with the other rows but the highlight never touches its\n   left edge. */\n[data-panel] .panel-toggle {\n  display: flex;\n  height: 36px;\n  width: calc(100% + 16px);\n  margin: 0 -8px;\n  align-items: center;\n  justify-content: space-between;\n  border-radius: 8px;\n  padding: 0 8px;\n  background: transparent;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-toggle:hover { background: var(--panel-toggle-hover); }\n.panel-toggle-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-toggle-track {\n  position: relative;\n  width: 28px;\n  height: 16px;\n  border-radius: 999px;\n  background: var(--panel-surface-idle-fill);\n  transition: background-color 200ms cubic-bezier(0.32, 0.72, 0, 1);\n  flex-shrink: 0;\n}\n.panel-toggle[data-panel-on=\"true\"] .panel-toggle-track {\n  background: var(--panel-handle);\n}\n.panel-toggle-thumb {\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 12px;\n  height: 12px;\n  border-radius: 999px;\n  background: var(--panel-bg);\n  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n.panel-toggle[data-panel-on=\"false\"] .panel-toggle-thumb {\n  background: var(--panel-handle);\n}\n.panel-toggle[data-panel-on=\"true\"] .panel-toggle-thumb {\n  transform: translateX(12px);\n}\n\n/* Segmented single-select \u2014 optional label, then option buttons sharing a\n   surface track. Selected uses the panel surface tokens, not a heavy fill. */\n.panel-toggle-group {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  width: 100%;\n  padding: 4px 0;\n}\n.panel-toggle-group-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n  line-height: 1.35;\n  padding: 0 2px;\n}\n.panel-toggle-group-track {\n  display: flex;\n  align-items: stretch;\n  gap: 2px;\n  padding: 2px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n}\n[data-panel] .panel-toggle-group-btn {\n  display: inline-flex;\n  flex: 1 1 0;\n  min-width: 0;\n  height: 28px;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  border-radius: 6px;\n  padding: 0 10px;\n  color: var(--panel-text-muted);\n  font-family: inherit;\n  font-size: 12px;\n  font-weight: 500;\n  line-height: 1;\n  cursor: pointer;\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-toggle-group-icon {\n  display: inline-flex;\n  flex-shrink: 0;\n}\n.panel-toggle-group-icon svg {\n  width: 14px;\n  height: 14px;\n  display: block;\n}\n.panel-toggle-group-text {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n[data-panel] .panel-toggle-group-btn:hover {\n  color: var(--panel-action-text-hover);\n  background: var(--panel-toggle-hover);\n}\n[data-panel] .panel-toggle-group-btn:focus-visible {\n  outline: 2px solid var(--panel-handle);\n  outline-offset: -2px;\n}\n[data-panel] .panel-toggle-group-btn[data-panel-active=\"true\"] {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-toggle-group-btn:active { transform: scale(0.98); }\n@media (prefers-reduced-motion: reduce) {\n  [data-panel] .panel-toggle-group-btn { transition: none; }\n  [data-panel] .panel-toggle-group-btn:active { transform: none; }\n}\n\n.panel-select {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  background: transparent;\n}\n.panel-select[data-panel-layout=\"inline\"] {\n  min-height: 36px;\n  height: 36px;\n  border-radius: 8px;\n  padding: 0 12px;\n  background: var(--panel-surface);\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-select[data-panel-layout=\"inline\"]:hover {\n  background: var(--panel-surface-active);\n}\n.panel-select[data-panel-layout=\"stacked\"] {\n  flex-direction: column;\n  align-items: stretch;\n  gap: 6px;\n  min-height: 0;\n  height: auto;\n  padding: 0;\n  background: transparent;\n}\n.panel-select-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n  min-width: 0;\n  line-height: 1.35;\n}\n.panel-select[data-panel-layout=\"stacked\"] .panel-select-label {\n  white-space: normal;\n}\n.panel-select[data-panel-layout=\"inline\"] .panel-select-label {\n  flex: 1 1 auto;\n  white-space: normal;\n}\n[data-panel] .panel-select-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  flex-shrink: 0;\n  border: 0;\n  outline: 0;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: normal;\n  cursor: pointer;\n  height: 36px;\n  min-height: 36px;\n  padding: 0 12px;\n  border-radius: 8px;\n  overflow: visible;\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-select[data-panel-layout=\"stacked\"] .panel-select-btn {\n  align-self: stretch;\n  width: 100%;\n  max-width: none;\n  justify-content: space-between;\n}\n.panel-select[data-panel-layout=\"inline\"] .panel-select-btn {\n  align-self: center;\n  flex: 1 1 auto;\n  max-width: none;\n  height: 100%;\n  justify-content: flex-end;\n  padding: 0;\n  background: transparent;\n  border-radius: 0;\n}\n.panel-select[data-panel-layout=\"inline\"] .panel-select-btn:hover,\n.panel-select[data-panel-layout=\"inline\"] .panel-select-btn:focus-visible {\n  background: transparent;\n}\n/* Ellipsis horizontally only \u2014 vertical overflow clips descenders in custom fonts. */\n.panel-select-value {\n  min-width: 0;\n  overflow-x: hidden;\n  overflow-y: visible;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  line-height: 1.35;\n}\n[data-panel] .panel-select-btn:hover {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-select-btn:focus-visible {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n  outline: 2px solid var(--panel-handle);\n  outline-offset: 1px;\n}\n[data-panel] .panel-select-btn:active { transform: none; }\n.panel-select[data-panel-layout=\"stacked\"] .panel-select-btn:active {\n  transform: none;\n}\n.panel-select-chevron {\n  width: 14px;\n  height: 14px;\n  opacity: 0.6;\n  flex-shrink: 0;\n}\n.panel-select-layer {\n  position: fixed;\n  inset: 0;\n  z-index: 10000;\n  pointer-events: none;\n}\n.panel-select-menu {\n  pointer-events: auto;\n  overflow-y: auto;\n  padding: 4px;\n  border-radius: 10px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.2);\n  -webkit-backdrop-filter: blur(16px);\n  backdrop-filter: blur(16px);\n  animation: panel-menu-in 160ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-select-menu[data-panel-up=\"true\"] {\n  animation-name: panel-menu-in-up;\n}\n@keyframes panel-menu-in {\n  from {\n    opacity: 0;\n    transform: translate(-100%, 0) translateY(-4px);\n    filter: blur(2px);\n  }\n  to {\n    opacity: 1;\n    transform: translate(-100%, 0) translateY(0);\n    filter: blur(0);\n  }\n}\n@keyframes panel-menu-in-up {\n  from {\n    opacity: 0;\n    transform: translate(-100%, -100%) translateY(4px);\n    filter: blur(2px);\n  }\n  to {\n    opacity: 1;\n    transform: translate(-100%, -100%) translateY(0);\n    filter: blur(0);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-select-menu { animation: none; }\n}\n[data-panel] .panel-select-option {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  border: 0;\n  background: transparent;\n  color: var(--panel-label);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.2;\n  text-align: left;\n  white-space: nowrap;\n  min-height: 36px;\n  padding: 0 12px;\n  border-radius: 8px;\n  cursor: pointer;\n  transition: background-color 120ms cubic-bezier(0.22, 1, 0.36, 1),\n    color 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-select-option[data-panel-active=\"true\"] {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-select-option[aria-selected=\"true\"] {\n  color: var(--panel-text);\n}\n.panel-select-check {\n  width: 14px;\n  height: 14px;\n  flex-shrink: 0;\n  opacity: 0.9;\n}\n\n.panel-prompt {\n  display: flex;\n  flex-direction: column;\n}\n/* Bumped under [data-panel] so it ties the button reset on specificity\n   and wins on source order \u2014 the reset sets padding: 0 globally. */\n[data-panel] .panel-prompt-toggle {\n  display: flex;\n  height: 36px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 13px;\n  font-weight: 500;\n  text-align: left;\n  transition: color 150ms ease;\n}\n[data-panel] .panel-prompt-toggle:hover,\n.panel-prompt[data-panel-open=\"true\"] .panel-prompt-toggle {\n  color: var(--panel-label-active);\n}\n.panel-prompt-label {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  min-width: 0;\n}\n.panel-prompt-caret {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  transition: transform 200ms ease;\n}\n.panel-prompt[data-panel-open=\"true\"] .panel-prompt-caret { transform: rotate(180deg); }\n\n.panel-prompt-preview {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 6px 0 2px;\n}\n.panel-prompt-desc {\n  font-size: 11px;\n  color: var(--panel-text-muted);\n  line-height: 1.4;\n  padding: 0 4px;\n}\n.panel-prompt-code-wrap {\n  position: relative;\n}\n.panel-prompt-pre {\n  margin: 0;\n  padding: 10px 12px 22px;\n  background: var(--panel-bg);\n  color: var(--panel-text);\n  border: 1px solid var(--panel-border);\n  border-radius: 8px;\n  font-family: inherit;\n  font-size: 11px;\n  line-height: 1.5;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 140px;\n  overflow-y: auto;\n  scrollbar-width: thin;\n  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);\n  mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);\n}\n.panel-prompt-pre::-webkit-scrollbar { width: 6px; }\n.panel-prompt-pre::-webkit-scrollbar-thumb { background: var(--panel-surface-active); border-radius: 999px; }\n/* Scoped under [data-panel] to beat the global button reset\n   (background: transparent) on specificity \u2014 otherwise the button is\n   transparent and the prompt text shows through behind the icon. The text\n   field (--panel-bg) is ~95% opaque, so stack two copies \u2192 ~99.8% opaque, same hue. */\n[data-panel] .panel-prompt-copy {\n  position: absolute;\n  bottom: 6px;\n  right: 6px;\n  width: 26px;\n  height: 26px;\n  border-radius: 6px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background:\n    linear-gradient(var(--panel-bg), var(--panel-bg)),\n    linear-gradient(var(--panel-bg), var(--panel-bg));\n  color: var(--panel-label);\n  border: 1px solid var(--panel-border);\n  transition: color 150ms ease, transform 200ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n.panel-prompt-copy svg { width: 14px; height: 14px; }\n[data-panel] .panel-prompt-copy:hover {\n  /* Subtle surface tint over the opaque base. */\n  background:\n    linear-gradient(var(--panel-surface), var(--panel-surface)),\n    linear-gradient(var(--panel-bg), var(--panel-bg)),\n    linear-gradient(var(--panel-bg), var(--panel-bg));\n  color: var(--panel-label-active);\n  transform: scale(1.05);\n}\n\n.panel-vec2 {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-vec2-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n  padding: 0 12px;\n}\n.panel-vec2-row {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px;\n}\n\n/* \u2500\u2500 Preset selector \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-presets {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 0 12px 2px;\n}\n.panel-presets-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n[data-panel] .panel-preset-select {\n  appearance: none;\n  -webkit-appearance: none;\n  width: 100%;\n  height: 36px;\n  border: 1px solid var(--panel-border);\n  border-radius: 8px;\n  padding: 0 28px 0 12px;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1;\n  color: var(--panel-label);\n  background:\n    linear-gradient(45deg, transparent 50%, var(--panel-muted-icon) 50%),\n    linear-gradient(135deg, var(--panel-muted-icon) 50%, transparent 50%),\n    var(--panel-surface);\n  background-position: calc(100% - 14px) 50%, calc(100% - 10px) 50%, 0 0;\n  background-size: 4px 4px, 4px 4px, auto;\n  background-repeat: no-repeat;\n  cursor: pointer;\n  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;\n}\n[data-panel] .panel-preset-select:hover {\n  color: var(--panel-label-active);\n  background-color: var(--panel-surface-active);\n}\n[data-panel] .panel-preset-select:focus-visible {\n  outline: 2px solid var(--panel-handle);\n  outline-offset: 1px;\n}\n\n/* \u2500\u2500 ToolShell layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-tool-shell {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n}\n.panel-tool-viewport {\n  position: absolute;\n  inset: 0;\n  z-index: 0;\n}\n.panel-tool-overlay {\n  pointer-events: none;\n  position: absolute;\n  inset: 0;\n  z-index: 20;\n  transition: opacity 500ms ease;\n}\n.panel-tool-overlay[data-panel-ui-visible=\"false\"] {\n  opacity: 0;\n}\n.panel-tool-topbar {\n  pointer-events: none;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding-top: 16px;\n  padding-bottom: 16px;\n  transition: padding 300ms ease;\n}\n.panel-tool-topbar > * {\n  pointer-events: auto;\n}\n.panel-tool-panels {\n  pointer-events: none;\n  position: absolute;\n  inset: 0;\n}\n\n.panel-panel-toggle {\n  pointer-events: auto;\n  position: absolute;\n  bottom: 20px;\n  z-index: 30;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 10px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  color: var(--panel-text-muted);\n  box-shadow: var(--panel-shadow);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transition: left 300ms ease, right 300ms ease, background 150ms ease, color 150ms ease;\n}\n.panel-panel-toggle:hover {\n  background: var(--panel-surface);\n  color: var(--panel-text);\n}\n.panel-panel-toggle-icon {\n  width: 16px;\n  height: 16px;\n  transition: transform 300ms ease;\n}\n\n/* \u2500\u2500 Canvas overlay projector (OFF-138) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n/* A single layer pinned over the canvas. Click-through by default so it never\n   eats canvas pointer events; individual overlay items opt back in if needed.\n   overflow: visible so items projected near the edges are not clipped. */\n.panel-overlay-layer {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  overflow: visible;\n}\n/* Each projected node. Positioned via transform only (translate \u2192 the screen\n   point, then -50%/-50% to center). will-change hints the compositor; no\n   layout-thrashing properties are ever written. */\n.panel-overlay-item {\n  position: absolute;\n  top: 0;\n  left: 0;\n  will-change: transform;\n}\n\n.panel-eye-toggle {\n  pointer-events: auto;\n  position: absolute;\n  bottom: 20px;\n  left: 50%;\n  z-index: 30;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 999px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  color: var(--panel-text-muted);\n  box-shadow: var(--panel-shadow);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  transform: translateX(-50%);\n  transition: background 150ms ease, color 500ms ease, opacity 500ms ease;\n}\n.panel-eye-toggle[data-panel-visible=\"false\"] {\n  color: color-mix(in srgb, var(--panel-text-muted) 30%, transparent);\n}\n.panel-eye-toggle:hover {\n  background: var(--panel-surface);\n  color: var(--panel-text);\n}\n.panel-eye-toggle svg {\n  width: 16px;\n  height: 16px;\n}\n\n/* \u2500\u2500 Disclosure rows (POI / caption editors) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-disclosure {\n  display: flex;\n  flex-direction: column;\n}\n.panel-disclosure[data-panel-open=\"true\"] {\n  margin-bottom: 10px;\n}\n.panel-disclosure[data-panel-dimmed=\"true\"] {\n  opacity: 0.38;\n  pointer-events: none;\n}\n.panel-disclosure[data-panel-highlight=\"true\"] .panel-disclosure-toggle {\n  box-shadow: inset 0 0 0 1px var(--panel-handle);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-disclosure-toggle {\n  display: flex;\n  height: 36px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 13px;\n  font-weight: 500;\n  text-align: left;\n  transition: color 150ms ease, background-color 150ms ease;\n}\n[data-panel] .panel-disclosure-toggle:hover,\n.panel-disclosure[data-panel-open=\"true\"] .panel-disclosure-toggle {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n.panel-disclosure-label {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  min-width: 0;\n}\n.panel-disclosure-caret {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  transition: transform 200ms ease;\n}\n.panel-disclosure[data-panel-open=\"true\"] .panel-disclosure-caret {\n  transform: rotate(180deg);\n}\n.panel-disclosure-body {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 6px 0 14px;\n}\n/* Nested editors \u2014 damp hover scale so sliders don't spill past inset padding. */\n[data-panel] .panel-disclosure-body .panel-slider,\n[data-panel] .panel-vec2-row .panel-slider {\n  width: 100%;\n  margin: 0;\n}\n[data-panel] .panel-disclosure-body .panel-slider[data-panel-state=\"hover\"],\n[data-panel] .panel-vec2-row .panel-slider[data-panel-state=\"hover\"] {\n  transform: none;\n}\n[data-panel] .panel-disclosure-body .panel-slider[data-panel-state=\"drag\"],\n[data-panel] .panel-vec2-row .panel-slider[data-panel-state=\"drag\"] {\n  transform: scale(1.008);\n}\n[data-panel] .panel-disclosure-body .panel-toggle {\n  width: 100%;\n  margin: 0;\n}\n\n/* \u2500\u2500 Collection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-collection {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n.panel-collection-header {\n  display: flex;\n  height: 36px;\n  align-items: center;\n  gap: 8px;\n}\n.panel-collection-title {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-collection-count {\n  display: inline-flex;\n  min-width: 18px;\n  height: 18px;\n  align-items: center;\n  justify-content: center;\n  padding: 0 5px;\n  border-radius: 999px;\n  background: var(--panel-surface);\n  font-size: 11px;\n  font-weight: 500;\n  font-variant-numeric: tabular-nums;\n  color: var(--panel-text-muted);\n}\n[data-panel] .panel-collection-add {\n  margin-left: auto;\n  height: 28px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  font-size: 12px;\n  font-weight: 500;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-collection-add:hover:not(:disabled) {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-collection-add:active:not(:disabled) {\n  transform: scale(0.98);\n}\n[data-panel] .panel-collection-add:disabled {\n  opacity: 0.4;\n  cursor: not-allowed;\n}\n.panel-collection-items {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-collection-empty {\n  padding: 8px 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  font-size: 11px;\n  color: var(--panel-text-muted);\n}\n.panel-collection-row {\n  display: flex;\n  flex-direction: column;\n  border-radius: 8px;\n  transition: opacity 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-collection-row[data-panel-dragging=\"true\"] {\n  opacity: 0.5;\n}\n.panel-collection-row[data-panel-dragover=\"true\"] {\n  box-shadow: inset 0 0 0 1px var(--panel-handle);\n}\n.panel-collection-row-head {\n  display: flex;\n  height: 36px;\n  align-items: center;\n  gap: 4px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  padding: 0 4px 0 6px;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-collection-row[data-panel-open=\"true\"] .panel-collection-row-head {\n  background: var(--panel-surface-active);\n}\n.panel-collection-drag {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  cursor: grab;\n}\n.panel-collection-drag:active {\n  cursor: grabbing;\n}\n.panel-collection-drag svg {\n  width: 14px;\n  height: 14px;\n}\n[data-panel] .panel-collection-row-toggle {\n  display: flex;\n  flex: 1;\n  min-width: 0;\n  height: 36px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 4px;\n  background: transparent;\n  color: var(--panel-label);\n  font-size: 13px;\n  font-weight: 500;\n  text-align: left;\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-collection-row-toggle:hover,\n.panel-collection-row[data-panel-open=\"true\"] .panel-collection-row-toggle {\n  color: var(--panel-label-active);\n}\n.panel-collection-row-label {\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-collection-caret {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-collection-row[data-panel-open=\"true\"] .panel-collection-caret {\n  transform: rotate(180deg);\n}\n[data-panel] .panel-collection-remove {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 26px;\n  height: 26px;\n  flex-shrink: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--panel-muted-icon);\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-collection-remove:hover:not(:disabled) {\n  color: var(--panel-danger);\n  background: var(--panel-surface);\n}\n[data-panel] .panel-collection-remove:active:not(:disabled) {\n  transform: scale(0.98);\n}\n[data-panel] .panel-collection-remove:disabled {\n  opacity: 0.3;\n  cursor: not-allowed;\n}\n.panel-collection-remove svg {\n  width: 13px;\n  height: 13px;\n}\n.panel-collection-row-body {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 8px 10px 12px;\n}\n\n/* \u2500\u2500 Reference \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-reference {\n  display: flex;\n  flex-direction: column;\n}\n[data-panel] .panel-reference-trigger {\n  display: block;\n  width: 100%;\n  padding: 0;\n  background: transparent;\n  text-align: left;\n  transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-reference-trigger:active {\n  transform: scale(0.98);\n}\n[data-panel] .panel-reference-trigger .panel-readout {\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-reference-trigger:hover .panel-readout {\n  background: var(--panel-surface-active);\n}\n.panel-reference-picker {\n  padding-top: 6px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .panel-collection-add,\n  .panel-collection-remove,\n  .panel-collection-caret,\n  .panel-collection-row,\n  .panel-collection-row-head,\n  .panel-collection-row-toggle,\n  .panel-reference-trigger,\n  .panel-reference-trigger .panel-readout {\n    transition: none;\n  }\n}\n\n/* \u2500\u2500 Text input \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-text {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-text[data-panel-layout=\"inline\"] {\n  flex-direction: row;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  min-height: 36px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n}\n.panel-text-label,\n.panel-search-label,\n.panel-textarea-label {\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n  padding: 0;\n  line-height: 1.35;\n}\n.panel-text[data-panel-layout=\"inline\"] .panel-text-label {\n  padding: 0;\n  flex-shrink: 0;\n}\n[data-panel] .panel-text-input {\n  width: 100%;\n  height: 36px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.2;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n.panel-text[data-panel-layout=\"inline\"] .panel-text-input {\n  flex: 1;\n  min-width: 0;\n  padding: 0;\n  height: 100%;\n  background: transparent;\n  text-align: right;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-text[data-panel-layout=\"inline\"] .panel-text-input:focus {\n  background: transparent;\n}\n[data-panel] .panel-text-input[data-panel-mono=\"true\"] {\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 12px;\n}\n[data-panel] .panel-text-input:focus {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-text-input::placeholder {\n  color: var(--panel-muted-icon);\n  text-transform: none;\n}\n\n/* \u2500\u2500 Textarea \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-textarea {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n[data-panel] .panel-textarea-input {\n  width: 100%;\n  min-height: 72px;\n  resize: vertical;\n  padding: 8px 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-family: inherit;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.45;\n  outline: none;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-textarea-input:focus {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-textarea-input::placeholder {\n  color: var(--panel-muted-icon);\n}\n\n.panel-search {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-search-row {\n  display: flex;\n  align-items: stretch;\n  gap: 6px;\n}\n[data-panel] .panel-search-input {\n  flex: 1;\n  min-width: 0;\n  height: 36px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 1.2;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-search-input:focus {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-search-input::placeholder {\n  color: var(--panel-muted-icon);\n}\n[data-panel] .panel-search-btn {\n  flex-shrink: 0;\n  height: 36px;\n  padding: 0 12px;\n  border-radius: 8px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: 0.01em;\n  transition: background-color 150ms ease, color 150ms ease, transform 120ms ease;\n}\n[data-panel] .panel-search-btn:hover:not(:disabled) {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-search-btn:active:not(:disabled) {\n  transform: scale(0.98);\n}\n[data-panel] .panel-search-btn:disabled {\n  opacity: 0.55;\n  cursor: not-allowed;\n}\n.panel-search-error {\n  padding: 0 12px;\n  font-size: 11px;\n  line-height: 1.35;\n  color: #ef4444;\n}\n\n/* \u2500\u2500 Readout row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-readout {\n  display: flex;\n  min-height: 36px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 8px 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n}\n.panel-readout-label {\n  flex-shrink: 0;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--panel-label);\n}\n.panel-readout-value {\n  min-width: 0;\n  font-size: 12px;\n  font-weight: 500;\n  font-variant-numeric: tabular-nums;\n  color: var(--panel-text-muted);\n  text-align: right;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* \u2500\u2500 Option list (search results, pickers) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-option-list-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-option-list-title {\n  padding: 0 12px;\n  font-size: 11px;\n  font-weight: 600;\n  letter-spacing: 0.03em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n}\n.panel-option-list {\n  display: flex;\n  max-height: 168px;\n  flex-direction: column;\n  gap: 4px;\n  overflow-y: auto;\n  padding: 4px;\n  border-radius: 8px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  scrollbar-width: thin;\n}\n.panel-option-list::-webkit-scrollbar {\n  width: 6px;\n}\n.panel-option-list::-webkit-scrollbar-thumb {\n  background: var(--panel-surface-active);\n  border-radius: 999px;\n}\n[data-panel] .panel-option-item {\n  display: flex;\n  width: 100%;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 2px;\n  padding: 8px 10px;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--panel-label);\n  text-align: left;\n  transition: background-color 120ms ease, color 120ms ease;\n}\n[data-panel] .panel-option-item:hover:not(:disabled) {\n  background: var(--panel-surface);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-option-item:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n.panel-option-item-label {\n  width: 100%;\n  font-size: 12px;\n  font-weight: 600;\n  line-height: 1.3;\n  color: inherit;\n}\n.panel-option-item-desc {\n  width: 100%;\n  font-size: 10.5px;\n  line-height: 1.35;\n  color: var(--panel-text-muted);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n.panel-option-empty {\n  padding: 8px 12px;\n  border-radius: 8px;\n  background: var(--panel-surface);\n  font-size: 11px;\n  line-height: 1.35;\n  color: var(--panel-text-muted);\n}\n\n/* \u2500\u2500 Hint copy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-hint {\n  margin: 0;\n  padding: 0 12px 2px;\n  font-size: 11px;\n  line-height: 1.4;\n  color: var(--panel-text-muted);\n}\n";

interface ControlActionProps {
    label: string;
    description?: string;
    onClick: () => void;
    disabled?: boolean;
    variant?: "default" | "primary" | "destructive";
    className?: string;
}
/**
 * Panel action button — triggers a one-off handler (open editor, re-run
 * pipeline, etc.) without writing to shader config.
 */
declare function ControlAction({ label, description, onClick, disabled, variant, className, }: ControlActionProps): react.JSX.Element;

interface ControlActionGroupProps {
    children: React.ReactNode;
    className?: string;
}
/** Horizontal row of action buttons — e.g. Link + Remove. */
declare function ControlActionGroup({ children, className, }: ControlActionGroupProps): react.JSX.Element;

interface ControlSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    className?: string;
}
declare function ControlSlider({ label, value, min, max, step, onChange, className, }: ControlSliderProps): react.JSX.Element;

interface ControlSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    /** Controlled open state — pair with `onOpenChange`. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    /** Called when the user clicks the ↻ icon in the section header. */
    onReset?: () => void;
}
declare function ControlSection({ title, children, defaultOpen, open: openProp, onOpenChange, className, onReset, }: ControlSectionProps): react.JSX.Element;

interface ControlColorInputProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    className?: string;
}
declare function ControlColorInput({ label, value, onChange, className, }: ControlColorInputProps): react.JSX.Element;

interface ControlImageInputProps {
    label: string;
    /** Image URL — asset path, object URL, or data URL. Empty string = no image. */
    value: string;
    onChange?: (v: string) => void;
    /** Preview-only (generated outputs) — hides upload + drop affordances. */
    readonly?: boolean;
    /** `accept` for the file picker. Default `"image/*"`. */
    accept?: string;
    /** Muted text shown when `value` is empty. */
    emptyLabel?: string;
    className?: string;
}
/**
 * Image slot: label row + thumbnail preview. Unless `readonly`, clicking the
 * preview (or dropping a file on it) picks a local image and emits an object
 * URL via `onChange`. Old object URLs are not revoked here — the consumer may
 * still be sampling them (e.g. as a GPU texture).
 */
declare function ControlImageInput({ label, value, onChange, readonly, accept, emptyLabel, className, }: ControlImageInputProps): react.JSX.Element;

type PathPoint = readonly [number, number];
interface ControlPathProps {
    label: string;
    /** Ordered waypoints in [min,max] space. */
    value: ReadonlyArray<PathPoint>;
    onChange: (v: PathPoint[]) => void;
    min: number;
    max: number;
    /** Home point drawn as the start of the path. Draggable when `onAnchorChange` is set. */
    anchor?: PathPoint;
    onAnchorChange?: (v: PathPoint) => void;
    emptyLabel?: string;
    className?: string;
}
/**
 * 2D waypoint editor. Click empty pad to append a point, drag dots to move,
 * double-click to remove. The home/anchor point is always draggable when
 * `onAnchorChange` is set — it never spawns a duplicate waypoint.
 */
declare function ControlPath({ label, value, onChange, min, max, anchor, onAnchorChange, emptyLabel, className, }: ControlPathProps): react.JSX.Element;

interface ControlToggleProps {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    className?: string;
}
declare function ControlToggle({ label, value, onChange, className, }: ControlToggleProps): react.JSX.Element;

type ControlToggleGroupOption = {
    value: string | number;
    /** Text label. Omit when using an icon-only option. */
    label?: string;
    /** Icon node rendered in place of (or alongside) the label. */
    icon?: ReactNode;
};
interface ControlToggleGroupProps {
    /** Optional heading rendered above the segmented control. */
    label?: string;
    value: string | number;
    options: ReadonlyArray<ControlToggleGroupOption>;
    onChange: (v: string | number) => void;
    className?: string;
}
/**
 * Segmented single-select control: an optional label, then N option buttons
 * sharing one track. Each option is text, an icon, or both. The selected value
 * is highlighted with the panel's surface/accent tokens (not a heavy fill).
 */
declare function ControlToggleGroup({ label, value, options, onChange, className, }: ControlToggleGroupProps): react.JSX.Element;

interface ControlThemeToggleProps {
    className?: string;
    /** sessionStorage key for persisting the user's choice. */
    storageKey?: string;
}
declare function ControlThemeToggle({ className, storageKey, }: ControlThemeToggleProps): react.JSX.Element;

interface ControlSelectProps {
    label: string;
    value: string | number;
    options: ReadonlyArray<PanelSelectOption>;
    onChange: (v: string | number) => void;
    /** Label above control (default) or on the same row. */
    layout?: "inline" | "stacked";
    className?: string;
}
/**
 * Custom dropdown — replaces the native <select>, which can't be themed.
 * The menu portals to <body> (fixed-position, flips above when there's no
 * room below) so the panel's overflow scrolling never clips it.
 */
declare function ControlSelect({ label, value, options, onChange, layout, className, }: ControlSelectProps): react.JSX.Element;

interface ControlVec2Props {
    label: string;
    value: readonly [number, number];
    min: number;
    max: number;
    step: number;
    xLabel?: string;
    yLabel?: string;
    onChange: (v: [number, number]) => void;
    className?: string;
}
declare function ControlVec2({ label, value, min, max, step, xLabel, yLabel, onChange, className, }: ControlVec2Props): react.JSX.Element;

type ControlPresetOption<T extends Record<string, unknown>> = {
    label: string;
    values?: Partial<T> | ((current: T) => T);
    actionId?: string;
};
interface ControlPresetsProps<T extends Record<string, unknown>> {
    presets: ReadonlyArray<ControlPresetOption<T>>;
    values: T;
    onChange: (next: T) => void;
    label?: string;
    className?: string;
    actionHandlers?: Record<string, () => void>;
}
declare function ControlPresets<T extends Record<string, unknown>>({ presets, values, onChange, label, className, actionHandlers, }: ControlPresetsProps<T>): react.JSX.Element;

interface ControlDisclosureProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    /** De-emphasize while another row is in a focused mode (e.g. linking). */
    dimmed?: boolean;
    /** Emphasize the active row during an inline flow. */
    highlighted?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}
declare function ControlDisclosure({ title, children, defaultOpen, open: openProp, onOpenChange, className, dimmed, highlighted, onMouseEnter, onMouseLeave, }: ControlDisclosureProps): react.JSX.Element;

/**
 * Signature the collection uses to render item fields recursively.
 *
 * `values` / `setValues` are scoped to the object being edited (the item for
 * nested fields, the panel state at the top level). `rootValues` /
 * `setRootValues` always point at the panel's top-level state so a
 * `reference` field can resolve a sibling collection no matter how deeply it
 * is nested.
 */
type RenderFieldContext = {
    values: Record<string, unknown>;
    setValues: (next: Record<string, unknown>) => void;
    rootValues: Record<string, unknown>;
    setRootValues: (next: Record<string, unknown>) => void;
    actionHandlers?: Record<string, () => void>;
    /** Threaded to collections so the panel can surface the selected item id. */
    onCollectionSelect?: (collectionKey: string, id: string | null) => void;
};

interface ControlCollectionProps {
    field: PanelCollectionField<Record<string, unknown>, PanelCollectionItem>;
    items: PanelCollectionItem[];
    onChange: (next: PanelCollectionItem[]) => void;
    /** Render context threaded from the panel — root state lives here. */
    renderContext: RenderFieldContext;
    /** Fires with the open item's id (or null). Single-open only. */
    onSelect?: (id: string | null) => void;
    className?: string;
}
/**
 * A managed list of items. Header (label + count + Add), one disclosure row
 * per item; expanding a row renders that item's `itemFields` recursively
 * through the shared field renderer. Rows support remove, drag-to-reorder,
 * and single-open selection (the open row IS the selection).
 */
declare function ControlCollection({ field, items, onChange, renderContext, onSelect, className, }: ControlCollectionProps): react.JSX.Element;

interface ControlReferenceProps {
    field: PanelReferenceField<Record<string, unknown>>;
    value: string | string[] | undefined;
    onChange: (next: string | string[]) => void;
    /** Panel top-level state — the referenced collection is resolved from here. */
    rootValues: Record<string, unknown>;
    setRootValues: (next: Record<string, unknown>) => void;
    className?: string;
}
/**
 * Point at an item in a sibling collection. Shows the current target's label
 * (or `placeholder`); clicking opens a picker — the option list of the
 * referenced collection's items. Picking sets the id, or toggles it in the
 * array when `multiple`.
 */
declare function ControlReference({ field, value, onChange, rootValues, className, }: ControlReferenceProps): react.JSX.Element;

interface ControlHintProps {
    children: React.ReactNode;
    className?: string;
}
declare function ControlHint({ children, className }: ControlHintProps): react.JSX.Element;

interface ControlOptionListItem {
    id: string;
    label: string;
    description?: string;
    disabled?: boolean;
}
interface ControlOptionListProps {
    items: ReadonlyArray<ControlOptionListItem>;
    onSelect: (id: string) => void;
    title?: string;
    emptyLabel?: string;
    className?: string;
}
declare function ControlOptionList({ items, onSelect, title, emptyLabel, className, }: ControlOptionListProps): react.JSX.Element | null;

interface ControlReadoutProps {
    label: string;
    value?: string;
    emptyValue?: string;
    className?: string;
}
declare function ControlReadout({ label, value, emptyValue, className, }: ControlReadoutProps): react.JSX.Element;

interface ControlSearchFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onSearch: () => void;
    placeholder?: string;
    searching?: boolean;
    error?: string;
    searchLabel?: string;
    className?: string;
}
declare function ControlSearchField({ label, value, onChange, onSearch, placeholder, searching, error, searchLabel, className, }: ControlSearchFieldProps): react.JSX.Element;

interface ControlTextInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    layout?: "stacked" | "inline";
    monospace?: boolean;
    className?: string;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}
declare function ControlTextInput({ label, value, onChange, placeholder, layout, monospace, className, onKeyDown, }: ControlTextInputProps): react.JSX.Element;

interface ControlTextareaProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}
declare function ControlTextarea({ label, value, onChange, placeholder, rows, className, }: ControlTextareaProps): react.JSX.Element;

export { ControlAction, ControlActionGroup, type ControlActionGroupProps, type ControlActionProps, ControlAnimation, type ControlAnimationProps, ControlCollection, type ControlCollectionProps, ControlColorInput, type ControlColorInputProps, ControlDisclosure, type ControlDisclosureProps, ControlHint, type ControlHintProps, ControlImageInput, type ControlImageInputProps, ControlOptionList, type ControlOptionListItem, type ControlOptionListProps, ControlPath, type ControlPathProps, type ControlPresetOption, ControlPresets, type ControlPresetsProps, ControlReadout, type ControlReadoutProps, ControlReference, type ControlReferenceProps, ControlSearchField, type ControlSearchFieldProps, ControlSection, type ControlSectionProps, ControlSelect, type ControlSelectProps, ControlSlider, type ControlSliderProps, ControlTextInput, type ControlTextInputProps, ControlTextarea, type ControlTextareaProps, ControlThemeToggle, type ControlThemeToggleProps, ControlToggle, ControlToggleGroup, type ControlToggleGroupOption, type ControlToggleGroupProps, type ControlToggleProps, ControlVec2, type ControlVec2Props, EyeToggle, type EyeToggleProps, FloatingPanel, OverlayProjector, OverlayProjectorOptions, PANEL_ANIMATION_STEP, PANEL_CSS, PANEL_STYLE_ID, PANEL_TOGGLE_EVENT, Panel, type PanelAnimationSnapshot, PanelCollectionField, PanelCollectionItem, PanelField, PanelPrompt, PanelReferenceField, PanelRoot, PanelSelectOption, PanelSide, PanelTheme, PanelToggleButton, type PanelToggleButtonProps, PanelToolPanel, type PathPoint, RendererBinding, type ShaderCaptureFn, type ShaderGifExportFn, type ShaderGifExportOptions, type ShaderRecordFrameFn, type ShaderRecordingOptions, type ShaderVideoExportFn, type ShaderVideoSession, TOOL_PANEL_FULL, TOOL_PANEL_INSET, TOOL_PANEL_WIDTH, ToolPanel, type ToolPanelProps, ToolShell, type ToolShellProps, advancePanelAnimationDelta, clearPersistedPanelSections, clearPersistedPanelValues, createOverlayProjector, dispatchPanelToggle, embedPngDpi, getPanelAnimationRevision, getPanelAnimationSnapshot, getPanelAnimationTime, getShaderCapture, getShaderGifExport, getShaderRecordCanvas, getShaderRecordFrame, getShaderRecordPrepare, getShaderVideoExport, handlePanelShortcutKeydown, hasPersistedPanelValues, initPanelAnimationClock, installPanelKeyboard, loadPersistedPanelSections, loadPersistedPanelValues, matchPanelShortcut, pausePanelAnimation, persistPanelSections, persistPanelValues, playPanelAnimation, printMaxEdgePx, readPanelOpenFlag, registerShaderCapture, registerShaderGifExport, registerShaderRecordCanvas, registerShaderRecordFrame, registerShaderRecordPrepare, registerShaderVideoExport, resetPanelAnimation, setPanelAnimationRate, setPanelAnimationTime, setShaderRecording, stepPanelAnimationBackward, stepPanelAnimationForward, subscribePanelAnimation, subscribeShaderCapture, subscribeShaderRecording, togglePanelAnimation, usePanelShortcut, writePanelOpenFlag };
