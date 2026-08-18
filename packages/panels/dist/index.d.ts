import { R as RendererBinding, O as OverlayProjectorOptions, a as OverlayProjector, P as PanelTheme, b as PanelSide, c as PanelField, d as PanelPrompt, e as PanelSelectOption, f as PanelCollectionField, g as PanelCollectionItem, h as PanelReferenceField, C as ColorLibrary } from './use-panel-CCHDkUi0.js';
export { L as LibraryColor, i as LibraryColorMatch, j as LibraryGroup, k as OverlayAnchor, l as PANEL_THEME_STORAGE_KEY, m as PanelActionField, n as PanelColorField, o as PanelGradientStopsField, p as PanelImageField, q as PanelPathField, r as PanelPresetOption, s as PanelPresetsField, t as PanelRegistration, u as PanelSectionField, v as PanelSelectField, w as PanelSliderField, x as PanelState, y as PanelStripeTableField, z as PanelStripeTableOptions, A as PanelThemeProvider, B as PanelToggleField, D as PanelToggleGroupField, E as PanelToggleGroupOption, F as PanelVec2Field, G as PanelWriteResult, H as ProjectedPoint, U as UsePanelOptions, V as Vec3, I as applyPanelTheme, J as cssColorForHex, K as findLibraryColor, M as findLibraryColorByHex, N as getActivePanel, Q as getActivePanelForSide, S as getActivePanelId, T as getActivePanelIdForSide, W as getPanelRegistration, X as getPanelRegistrations, Y as getPanelRegistrationsForSide, Z as getPanelRevision, _ as isPanelSection, $ as p3ColorForHex, a0 as p3CssFromHex, a1 as registerPanel, a2 as setActivePanel, a3 as subscribePanelRegistration, a4 as supportsDisplayP3Color, a5 as unregisterPanel, a6 as usePanel, a7 as usePanelTheme, a8 as usePanelThemeContext } from './use-panel-CCHDkUi0.js';
import * as react from 'react';
import { ReactNode, CSSProperties } from 'react';

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

declare function FloatingPanel({ side, collapsed, onToggle, onOpen, title, titleSlot, children, className, defaultTheme, themeStorageKey, showThemeToggle, container, inline, peek, float, floatStorageKey, }: {
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
    /**
     * Free-float mode: drag the panel by its header, resize from every edge
     * and corner, dock to viewport edges. Replaces the slide-out collapse with
     * an instant hide and a scale-up entrance from the docked edge. Disables
     * peek. Default false.
     */
    float?: boolean;
    /** sessionStorage key that keeps the float placement across close/reopen. */
    floatStorageKey?: string;
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
/** A rendered field plus the React key to give it. `null` node = skip. */
type RenderedField = {
    node: ReactNode;
    reactKey: string;
};
/**
 * A field with any non-section type, using the erased `Record` value shape.
 * Callers narrow their own `PanelField<T>` to this before rendering — the
 * concrete `T` is erased here because the collection recurses across value
 * shapes (parent state vs. item) through the same renderer.
 */
type AnyRenderableField = Exclude<PanelField<Record<string, unknown>>, {
    type: "section";
}>;
/**
 * Render a single non-section field to a node. Extracted so the collection can
 * call it recursively for each item's `itemFields` — every existing control
 * works inside a collection item with zero extra code.
 *
 * Sections are handled by the panel's grouping pass, not here.
 */
declare function renderPanelField(field: AnyRenderableField, ctx: RenderFieldContext): RenderedField | null;

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
 *
 * Skin: the lab/leva dev panel — opaque #1c1c1c dark frame (light #ffffff),
 * one 11px Inter/system text size, compact ~24px control rows on #2a2a2a
 * surfaces with 4px radii, thin translucent scrollbars, and a bottom fade
 * mask while content is cut off below the fold.
 */
declare const PANEL_STYLE_ID = "shader-dev-styles";
declare const PANEL_CSS = "\n[data-panel] {\n  --panel-bg: #1c1c1c;\n  --panel-border: #262626;\n  --panel-text: #d4d4d4;\n  --panel-text-muted: #737373;\n  --panel-surface: #2a2a2a;\n  --panel-surface-active: #313131;\n  --panel-toggle-hover: #242424;\n  --panel-surface-idle-fill: #333333;\n  --panel-hash: rgba(255, 255, 255, 0.12);\n  --panel-handle: #a3a3a3;\n  --panel-label: #d4d4d4;\n  --panel-label-active: #ededed;\n  --panel-label-muted: #737373;\n  --panel-divider: #262626;\n  --panel-muted-icon: #6f6f6f;\n  --panel-swatch-border: #4a4a4a;\n  --panel-kbd-bg: #2a2a2a;\n  --panel-action-bg: #2a2a2a;\n  --panel-action-bg-hover: #313131;\n  --panel-action-text: #d4d4d4;\n  --panel-action-text-hover: #ededed;\n  --panel-danger: #f87171;\n  --panel-danger-hover: #fca5a5;\n  --panel-header-border: transparent;\n  --panel-close-icon: #d4d4d4;\n  --panel-close-icon-hover: #ededed;\n  --panel-scrollbar-thumb: rgba(255, 255, 255, 0.25);\n  --panel-shadow: 0 1px 2px rgb(0 0 0 / 0.28), 0 12px 32px rgb(0 0 0 / 0.32);\n}\n\n[data-panel][data-panel-theme=\"light\"] {\n  --panel-bg: #ffffff;\n  --panel-border: #f3f3f3;\n  --panel-text: #525252;\n  --panel-text-muted: #737373;\n  --panel-surface: #eeeeee;\n  --panel-surface-active: #e6e6e6;\n  --panel-toggle-hover: #f3f3f3;\n  --panel-surface-idle-fill: #e0e0e0;\n  --panel-hash: #d4d4d4;\n  --panel-handle: #8a8a8a;\n  --panel-label: #525252;\n  --panel-label-active: #404040;\n  --panel-label-muted: #737373;\n  --panel-divider: #f3f3f3;\n  --panel-muted-icon: #a3a3a3;\n  --panel-swatch-border: #d4d4d4;\n  --panel-kbd-bg: #eeeeee;\n  --panel-action-bg: #eeeeee;\n  --panel-action-bg-hover: #e6e6e6;\n  --panel-action-text: #525252;\n  --panel-action-text-hover: #404040;\n  --panel-danger: #dc2626;\n  --panel-danger-hover: #b91c1c;\n  --panel-header-border: transparent;\n  --panel-close-icon: #737373;\n  --panel-close-icon-hover: #404040;\n  --panel-scrollbar-thumb: rgba(0, 0, 0, 0.25);\n}\n\n/* Animatable fade height for the body's cut-off mask. */\n@property --panel-fade {\n  syntax: \"<length>\";\n  inherits: false;\n  initial-value: 0px;\n}\n\n[data-panel],\n[data-panel] *,\n[data-panel] *::before,\n[data-panel] *::after {\n  box-sizing: border-box;\n}\n\n/* Chrome elements shouldn't be selectable \u2014 labels, titles, buttons. Only\n   inputs and the prompt code block opt back in via the override below. */\n[data-panel] {\n  -webkit-user-select: none;\n  user-select: none;\n}\n[data-panel] input,\n[data-panel] textarea,\n[data-panel] .panel-prompt-pre,\n[data-panel] .panel-paste-textarea,\n[data-panel] .panel-text-input,\n[data-panel] .panel-textarea-input,\n[data-panel] .panel-search-input {\n  -webkit-user-select: text;\n  user-select: text;\n}\n\n[data-panel] button:not([class]) {\n  background: transparent;\n  border: 0;\n  padding: 0;\n  margin: 0;\n  font-family: inherit;\n  /* Intentionally NOT inheriting font-size \u2014 leaves component classes free to\n     set their own without losing to specificity. */\n  color: inherit;\n  cursor: pointer;\n}\n\n/* All panel chrome buttons carry panel-* classes \u2014 zero host-app borders\n   (Tailwind preflight, browser defaults, etc.) before component styles apply. */\n[data-panel] button[class*=\"panel-\"] {\n  border: 0;\n  outline: none;\n  appearance: none;\n  -webkit-appearance: none;\n  box-shadow: none;\n}\n\n[data-panel] input,\n[data-panel] select,\n[data-panel] textarea {\n  font-family: inherit;\n  font-size: inherit;\n  font-weight: inherit;\n  line-height: inherit;\n  color: inherit;\n  border: 0;\n  outline: none;\n  appearance: none;\n  -webkit-appearance: none;\n  box-shadow: none;\n}\n\n[data-panel] input.panel-color-text {\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1;\n  color: var(--panel-label);\n}\n\n.panel-floating {\n  pointer-events: auto;\n  position: fixed;\n  top: 16px;\n  bottom: 16px;\n  z-index: 9999;\n  display: flex;\n  width: 360px;\n  flex-direction: column;\n  opacity: 1;\n  filter: blur(0);\n  transition-property: transform, opacity, filter;\n  transition-duration: 280ms, 200ms, 200ms;\n  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1), ease-in, ease-in;\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n  font-size: 11px;\n  line-height: 1.4;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n.panel-floating[data-panel-side=\"left\"] { left: 16px; }\n.panel-floating[data-panel-side=\"right\"] { right: 16px; }\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-side=\"left\"] { transform: translateX(calc(-100% - 16px)); }\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-side=\"right\"] { transform: translateX(calc(100% + 16px)); }\n.panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) {\n  opacity: 0;\n  filter: blur(4px);\n  pointer-events: none;\n}\n\n/* Peek preview \u2014 a scaled-down sliver slides in when the viewport edge is\n   hovered while collapsed. Overrides the fully-hidden collapsed transform. */\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-peek=\"true\"] { cursor: pointer; }\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-peek=\"true\"][data-panel-side=\"right\"] {\n  transform: translateX(calc(100% - 56px)) scale(0.9);\n  transform-origin: right center;\n  opacity: 1;\n  filter: blur(0);\n  pointer-events: auto;\n}\n.panel-floating[data-panel-collapsed=\"true\"][data-panel-peek=\"true\"][data-panel-side=\"left\"] {\n  transform: translateX(calc(-100% + 56px)) scale(0.9);\n  transform-origin: left center;\n  opacity: 1;\n  filter: blur(0);\n  pointer-events: auto;\n}\n\n/* \u2500\u2500 Free-float mode \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n   The drag hook owns left/top inline; the stylesheet stops animating the\n   frame so gestures never fight a transition. Collapse hides instantly \u2014\n   the hook plays the scale-up entrance when the panel surfaces. */\n.panel-floating[data-panel-float=\"true\"] {\n  bottom: auto;\n  max-height: calc(100dvh - 32px);\n  transition: none;\n}\n.panel-floating[data-panel-float=\"true\"][data-panel-collapsed=\"true\"] {\n  display: none;\n}\n.panel-floating[data-panel-float=\"true\"] .panel-panel-header {\n  cursor: grab;\n  touch-action: none;\n}\n\n/* Invisible resize hit areas, inset so the rounded frame stays clean. */\n.panel-resize {\n  position: absolute;\n  z-index: 1000;\n  touch-action: none;\n}\n.panel-resize-n, .panel-resize-s {\n  right: 12px;\n  left: 12px;\n  height: 5px;\n  cursor: ns-resize;\n}\n.panel-resize-e, .panel-resize-w {\n  top: 12px;\n  bottom: 12px;\n  width: 5px;\n  cursor: ew-resize;\n}\n.panel-resize-n { top: 0; }\n.panel-resize-s { bottom: 0; }\n.panel-resize-e { right: 0; }\n.panel-resize-w { left: 0; }\n.panel-resize-ne, .panel-resize-nw, .panel-resize-se, .panel-resize-sw {\n  width: 12px;\n  height: 12px;\n}\n.panel-resize-ne { top: 0; right: 0; cursor: nesw-resize; }\n.panel-resize-nw { top: 0; left: 0; cursor: nwse-resize; }\n.panel-resize-se { right: 0; bottom: 0; cursor: nwse-resize; }\n.panel-resize-sw { bottom: 0; left: 0; cursor: nesw-resize; }\n\n/* Hovering an edge handle shows a light pill inside that edge. */\n.panel-resize-n::after, .panel-resize-s::after,\n.panel-resize-e::after, .panel-resize-w::after {\n  content: \"\";\n  position: absolute;\n  border-radius: 999px;\n  background: rgb(255 255 255 / 0.6);\n  opacity: 0;\n  transform: scale(0.4);\n  transition:\n    opacity 140ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 220ms cubic-bezier(0.35, 1.55, 0.65, 1);\n}\n[data-panel][data-panel-theme=\"light\"] .panel-resize-n::after,\n[data-panel][data-panel-theme=\"light\"] .panel-resize-s::after,\n[data-panel][data-panel-theme=\"light\"] .panel-resize-e::after,\n[data-panel][data-panel-theme=\"light\"] .panel-resize-w::after {\n  background: rgb(0 0 0 / 0.35);\n}\n.panel-resize-e::after, .panel-resize-w::after {\n  top: 50%;\n  width: 3px;\n  height: 28px;\n  margin-top: -14px;\n}\n.panel-resize-n::after, .panel-resize-s::after {\n  left: 50%;\n  width: 28px;\n  height: 3px;\n  margin-left: -14px;\n}\n.panel-resize-w::after { left: 7px; }\n.panel-resize-e::after { right: 7px; }\n.panel-resize-n::after { top: 7px; }\n.panel-resize-s::after { bottom: 7px; }\n.panel-resize-n:hover::after, .panel-resize-s:hover::after,\n.panel-resize-e:hover::after, .panel-resize-w:hover::after {\n  opacity: 1;\n  transform: scale(1);\n}\n\n/* Snap hint: a pill OUTSIDE the panel on the side it will dock to, armed\n   via data-snap-x / data-snap-y while dragging near a viewport edge. */\n.panel-snap-hint {\n  pointer-events: none;\n  position: absolute;\n  z-index: 1001;\n  border-radius: 999px;\n  background: var(--panel-bg);\n  opacity: 0;\n  transition:\n    opacity 140ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 220ms cubic-bezier(0.35, 1.55, 0.65, 1);\n}\n[data-panel][data-panel-theme=\"light\"] .panel-snap-hint {\n  border: 1px solid var(--panel-border);\n}\n.panel-snap-hint-left, .panel-snap-hint-right {\n  top: 50%;\n  width: 4px;\n  height: 28px;\n  transform: translateY(-50%) scale(0.4);\n}\n.panel-snap-hint-top, .panel-snap-hint-bottom {\n  left: 50%;\n  width: 28px;\n  height: 4px;\n  transform: translateX(-50%) scale(0.4);\n}\n.panel-snap-hint-left { left: -8px; }\n.panel-snap-hint-right { right: -8px; }\n.panel-snap-hint-top { top: -8px; }\n.panel-snap-hint-bottom { bottom: -8px; }\n[data-snap-x=\"left\"] .panel-snap-hint-left,\n[data-snap-x=\"right\"] .panel-snap-hint-right {\n  opacity: 1;\n  transform: translateY(-50%) scale(1);\n}\n[data-snap-y=\"top\"] .panel-snap-hint-top,\n[data-snap-y=\"bottom\"] .panel-snap-hint-bottom {\n  opacity: 1;\n  transform: translateX(-50%) scale(1);\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-floating { transition: none; }\n  .panel-resize::after, .panel-snap-hint { transition: none; }\n  .panel-panel-body { transition: none; }\n  .panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) {\n    opacity: 0;\n    filter: none;\n  }\n  .panel-panel,\n  .panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) .panel-panel {\n    transition: none;\n    opacity: 1;\n    transform: none;\n  }\n}\n\n.panel-panel {\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  overflow: hidden;\n  border-radius: 8px;\n  background: var(--panel-bg);\n  color: var(--panel-text);\n  box-shadow: var(--panel-shadow);\n  opacity: 1;\n  transform: translateY(0) scale(1);\n  transition-property: opacity, transform;\n  transition-duration: 220ms;\n  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-floating[data-panel-collapsed=\"true\"]:not([data-panel-peek=\"true\"]) .panel-panel {\n  opacity: 0;\n  transform: translateY(-8px) scale(0.98);\n  transition-timing-function: ease-in;\n  transition-duration: 180ms;\n}\n\n/* Invisible hover/click strip pinned to the viewport edge \u2014 reveals the peek\n   (and reopens on click) while the panel is collapsed. */\n.panel-edge-sensor {\n  position: fixed;\n  top: 0;\n  bottom: 0;\n  width: 24px;\n  z-index: 9998;\n  cursor: pointer;\n}\n.panel-edge-sensor[data-panel-side=\"right\"] { right: 0; }\n.panel-edge-sensor[data-panel-side=\"left\"] { left: 0; }\n.panel-edge-sensor[data-panel-inline=\"true\"] { display: none; }\n\n/* Inline panels (ToolShell) use absolute positioning within the overlay. */\n.panel-floating[data-panel-inline=\"true\"] {\n  position: absolute;\n  z-index: 20;\n}\n\n/* Transparent click-catcher over the peeking panel \u2014 any click opens it fully\n   instead of hitting a control in the scaled-down preview. */\n.panel-peek-catch {\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  border-radius: 8px;\n  background: transparent;\n  cursor: pointer;\n}\n\n.panel-panel-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  border-bottom: 1px solid var(--panel-header-border);\n  padding: 8px 8px 4px 16px;\n  font-size: 11px;\n}\n.panel-panel-title-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n  flex: 1;\n}\n.panel-panel-title {\n  font-size: 11px;\n  font-weight: 500;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-panel-header-end {\n  display: flex;\n  flex-shrink: 0;\n  align-items: center;\n  gap: 4px;\n}\n/* Header variant of the toggle group \u2014 compact, icon-only, non-growing. */\n.panel-toggle-group.panel-theme-toggle {\n  width: auto;\n  padding: 0;\n}\n.panel-toggle-group.panel-theme-toggle .panel-toggle-group-track {\n  gap: 2px;\n  padding: 2px;\n}\n[data-panel] .panel-toggle-group.panel-theme-toggle .panel-toggle-group-btn {\n  flex: 0 0 auto;\n  width: 20px;\n  height: 20px;\n  padding: 0;\n}\n.panel-switcher {\n  appearance: none;\n  -webkit-appearance: none;\n  border: 0;\n  background: transparent;\n  color: var(--panel-text);\n  border-radius: 4px;\n  padding: 3px 20px 3px 8px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 1.4;\n  cursor: pointer;\n  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);\n  background-position: calc(100% - 10px) 50%, calc(100% - 6px) 50%;\n  background-size: 4px 4px, 4px 4px;\n  background-repeat: no-repeat;\n  max-width: 110px;\n  text-overflow: ellipsis;\n  overflow: hidden;\n  transition: background-color 150ms ease;\n}\n.panel-switcher:hover { background-color: var(--panel-surface); }\n.panel-switcher:focus { outline: none; background-color: var(--panel-surface); }\n\n.panel-close-btn {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 22px;\n  height: 22px;\n  border-radius: 4px;\n  color: var(--panel-close-icon);\n  transition-property: color, background-color, scale;\n  transition-duration: 150ms;\n  transition-timing-function: ease-out;\n}\n.panel-close-btn::before {\n  content: \"\";\n  position: absolute;\n  inset: -8px;\n}\n.panel-close-btn:active {\n  scale: 0.96;\n}\n.panel-close-btn:hover,\n.panel-close-btn:focus-visible {\n  color: var(--panel-close-icon-hover);\n  background: var(--panel-surface);\n}\n.panel-close-btn svg { width: 12px; height: 12px; }\n\n.panel-panel-body {\n  min-height: 0;\n  flex: 1;\n  overflow-x: hidden;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  padding: 8px 8px 32px;\n  scrollbar-width: thin;\n  scrollbar-color: var(--panel-scrollbar-thumb) transparent;\n  /* Content fades out at the bottom while more of it is cut off below\n     (.panel-body-cut-off is toggled from the scroll/resize observer). */\n  mask-image: linear-gradient(\n    to bottom,\n    black calc(100% - var(--panel-fade)),\n    transparent 100%\n  );\n  transition: --panel-fade 240ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-panel-body.panel-body-cut-off {\n  --panel-fade: 56px;\n}\n\n.panel-fields {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding-bottom: 8px;\n}\n\n/* Animation transport \u2014 pinned at the top of the panel body. */\n.panel-animation {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-bottom: 10px;\n  margin-bottom: 2px;\n  border-bottom: 1px solid var(--panel-divider);\n}\n.panel-animation-label {\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-animation-row {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n}\n[data-panel] .panel-animation-btn {\n  flex: 0 0 auto;\n  width: 24px;\n  height: 24px;\n  border-radius: 4px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--panel-action-text);\n  background: var(--panel-action-bg);\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-animation-btn svg {\n  width: 12px;\n  height: 12px;\n}\n[data-panel] .panel-animation-btn:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-animation-btn-primary {\n  width: 28px;\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-animation-btn-primary:hover {\n  background: var(--panel-handle);\n  color: var(--panel-bg);\n}\n[data-panel] .panel-animation-btn-reset {\n  margin-left: auto;\n}\n.panel-animation-time {\n  flex: 1;\n  min-width: 0;\n  padding: 0 6px;\n  font-family: inherit;\n  font-size: 11px;\n  font-variant-numeric: tabular-nums;\n  color: var(--panel-text-muted);\n  text-align: center;\n}\n\n.panel-shortcut-hint {\n  font-size: 11px;\n  color: var(--panel-text-muted);\n}\n.panel-shortcut-hint kbd {\n  border-radius: 4px;\n  padding: 0 4px;\n  font-family: inherit;\n  background: var(--panel-kbd-bg);\n}\n\n.panel-actions {\n  margin-top: 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  border-top: 1px solid var(--panel-divider);\n  padding-top: 12px;\n}\n\n.panel-export-format-row {\n  display: flex;\n  gap: 6px;\n}\n.panel-export-format-row .panel-action-btn {\n  flex: 1;\n  min-width: 0;\n}\n\n/* Scoped under [data-panel] to beat the global button reset on\n   specificity \u2014 otherwise the always-on surface fill loses. */\n[data-panel] .panel-action-btn {\n  width: 100%;\n  height: 24px;\n  border-radius: 4px;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  transition-property: background-color, color, scale;\n  transition-duration: 150ms;\n  transition-timing-function: ease-out;\n}\n[data-panel] .panel-action-btn:active:not(:disabled) {\n  scale: 0.98;\n}\n[data-panel] .panel-action-btn:hover:not(.panel-action-btn-primary):not(:disabled) {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }\n[data-panel] .panel-action-btn-primary {\n  background: var(--panel-handle);\n  color: var(--panel-bg);\n  border-color: transparent;\n}\n[data-panel] .panel-action-btn-primary:hover:not(:disabled) {\n  background: var(--panel-handle);\n  filter: brightness(1.08);\n  color: var(--panel-bg);\n}\n[data-panel] .panel-action-btn-destructive {\n  background: color-mix(in srgb, var(--panel-danger) 10%, var(--panel-action-bg));\n  color: var(--panel-danger);\n}\n[data-panel] .panel-action-btn-destructive:hover:not(:disabled) {\n  background: color-mix(in srgb, var(--panel-danger) 16%, var(--panel-action-bg-hover));\n  color: var(--panel-danger-hover);\n}\n\n.panel-action-group {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px;\n}\n.panel-action-group .panel-action-field {\n  min-width: 0;\n}\n.panel-action-group .panel-action-btn {\n  width: 100%;\n  padding-left: 8px;\n  padding-right: 8px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-action-field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.panel-status {\n  padding: 0 4px;\n  font-size: 11px;\n  color: var(--panel-text-muted);\n}\n\n/* Export group \u2014 pinned at the top of the actions block, separated from the\n   JSON/reset buttons by a hairline divider. */\n.panel-export {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-bottom: 12px;\n  margin-bottom: 4px;\n  border-bottom: 1px solid var(--panel-divider);\n}\n.panel-export-label {\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-export-row {\n  display: flex;\n  gap: 6px;\n}\n.panel-export-row .panel-action-btn {\n  flex: 1;\n}\n.panel-export-hint {\n  font-size: 11px;\n  line-height: 1.35;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-export-gif {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-top: 4px;\n  padding-top: 10px;\n  border-top: 1px solid var(--panel-divider);\n}\n.panel-export-gif-label {\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n  padding: 0 2px;\n}\n.panel-export-gif-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 2px;\n  padding: 2px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n}\n[data-panel] .panel-export-gif-row .panel-export-res-btn {\n  flex: 1 1 0;\n  min-width: 0;\n}\n\n/* Segmented resolution selector for the hi-res PNG. */\n.panel-export-res-group {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n.panel-export-res {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 2px;\n  padding: 2px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n}\n[data-panel] .panel-export-res-screen .panel-export-res-btn,\n[data-panel] .panel-export-res-print .panel-export-res-btn {\n  flex: 1 1 0;\n  min-width: 0;\n}\n[data-panel] .panel-export-res-btn {\n  min-width: 2.5rem;\n  height: 20px;\n  border-radius: 2px;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1;\n  color: var(--panel-text-muted);\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-export-res-btn:hover {\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-export-res-active,\n[data-panel] .panel-export-res-active:hover {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-export-rec,\n[data-panel] .panel-export-rec:hover {\n  background: #e5484d;\n  color: #ffffff;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n}\n.panel-export-dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 999px;\n  background: #ffffff;\n  animation: panel-export-pulse 1s ease-in-out infinite;\n}\n@keyframes panel-export-pulse {\n  0%, 100% { opacity: 1; }\n  50% { opacity: 0.25; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-export-dot { animation: none; }\n}\n\n/* Auto-height animation via CSS Grid: parent transitions\n   grid-template-rows between 0fr and 1fr, child clips overflow. */\n.panel-collapse {\n  display: grid;\n  grid-template-rows: 0fr;\n  overflow: hidden;\n  transition: grid-template-rows 280ms cubic-bezier(0.32, 0.72, 0, 1);\n}\n.panel-collapse[data-panel-open=\"true\"] {\n  grid-template-rows: 1fr;\n  overflow: visible;\n}\n.panel-collapse-inner {\n  /* Vertical clipping only \u2014 height animation still collapses, but horizontal\n     overshoot (slider overscroll spring, toggle row full-bleed hover) is not\n     cropped. inset(-16px 0) regressed toggle hovers (white side gutters). */\n  clip-path: inset(0 -9999px);\n  min-height: 0;\n  min-width: 0;\n  opacity: 0;\n  transition: opacity 200ms ease;\n}\n.panel-collapse[data-panel-open=\"true\"] > .panel-collapse-inner {\n  opacity: 1;\n  transition: opacity 200ms ease 80ms;\n}\n\n.panel-saved-indicator {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  padding: 4px 4px 2px;\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-text-muted);\n}\n.panel-saved-dot {\n  width: 6px;\n  height: 6px;\n  border-radius: 999px;\n  background: #22c55e;\n  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);\n  flex-shrink: 0;\n}\n\n.panel-paste {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 4px 0;\n}\n/* Scoped under [data-panel] to beat the global textarea reset on\n   specificity \u2014 otherwise the explicit small font-size loses. */\n[data-panel] .panel-paste-textarea {\n  width: 100%;\n  min-height: 96px;\n  resize: vertical;\n  padding: 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-text);\n  border: 0;\n  font-family: inherit;\n  font-size: 11px;\n  line-height: 1.5;\n  outline: none;\n  transition: background-color 150ms ease;\n}\n[data-panel] .panel-paste-textarea:focus {\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-paste-textarea::placeholder {\n  color: var(--panel-muted-icon);\n}\n.panel-paste-error {\n  padding: 0 4px;\n  font-size: 11px;\n  color: #ef4444;\n}\n\n.panel-empty {\n  pointer-events: auto;\n  position: fixed;\n  top: 16px;\n  right: 16px;\n  z-index: 9998;\n  max-width: 280px;\n  border-radius: 8px;\n  background: var(--panel-bg);\n  color: var(--panel-text-muted);\n  padding: 12px;\n  font-size: 11px;\n  box-shadow: var(--panel-shadow);\n  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n}\n.panel-empty-close {\n  margin-top: 8px;\n  display: block;\n  width: 100%;\n  border-radius: 4px;\n  padding: 6px 8px;\n  background: var(--panel-action-bg);\n  color: var(--panel-text);\n  font-size: 11px;\n}\n.panel-empty-close:hover { background: var(--panel-action-bg-hover); }\n\n.panel-section {\n  border-top: 1px solid var(--panel-divider);\n}\n.panel-section:first-child { border-top: 0; }\n.panel-section-header {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  gap: 4px;\n  padding: 10px 0 6px;\n}\n.panel-section:first-child .panel-section-header { padding-top: 2px; }\n.panel-section-button {\n  display: flex;\n  flex: 1;\n  min-width: 0;\n  align-items: center;\n  height: 20px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: -0.01em;\n  color: var(--panel-text);\n  text-align: left;\n}\n.panel-section-button:hover { color: var(--panel-label-active); }\n.panel-section-title {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-section-caret-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  border-radius: 4px;\n  color: var(--panel-muted-icon);\n  flex-shrink: 0;\n  transition: color 150ms ease, background-color 150ms ease;\n}\n.panel-section-caret-btn:hover { color: var(--panel-label-active); background: var(--panel-surface); }\n.panel-section-caret {\n  width: 12px;\n  height: 12px;\n  transition: transform 200ms ease;\n}\n.panel-section[data-panel-open=\"true\"] .panel-section-caret { transform: rotate(180deg); }\n.panel-section-reset {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  border-radius: 4px;\n  color: var(--panel-muted-icon);\n  opacity: 0;\n  transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease;\n  flex-shrink: 0;\n}\n.panel-section-reset svg { width: 12px; height: 12px; }\n.panel-section-header:hover .panel-section-reset,\n.panel-section-reset:focus-visible { opacity: 1; }\n.panel-section-reset:hover {\n  color: var(--panel-label-active);\n  background: var(--panel-surface);\n}\n.panel-section-children {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding-bottom: 10px;\n  overflow: visible;\n}\n\n.panel-field {\n  min-width: 0;\n  overflow: visible;\n}\n\n.panel-field-description {\n  font-size: 11px;\n  line-height: 1.35;\n  color: var(--panel-label-muted);\n  padding: 4px 4px 2px;\n  letter-spacing: 0.01em;\n}\n\n[data-panel] .panel-slider {\n  position: relative;\n  height: 24px;\n  width: 100%;\n  margin: 0;\n  overflow: visible;\n  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n[data-panel] .panel-slider[data-panel-state=\"hover\"] { transform: scale(1.01); }\n[data-panel] .panel-slider[data-panel-state=\"drag\"] { transform: scale(1.018); }\n\n.panel-slider-overscroll {\n  position: absolute;\n  inset: 0;\n  transform: scaleX(var(--panel-os-scale, 1));\n  transform-origin: var(--panel-os-origin, 50% 50%);\n}\n.panel-slider-overscroll[data-panel-release=\"true\"] {\n  transition: transform 320ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-slider-overscroll[data-panel-release=\"true\"] { transition: none; }\n  [data-panel] .panel-slider { transition: none; }\n}\n\n.panel-slider-track {\n  position: absolute;\n  inset: 0;\n  cursor: pointer;\n  user-select: none;\n  overflow: hidden;\n  touch-action: none;\n  border-radius: 4px;\n  background: var(--panel-surface);\n}\n\n.panel-slider-hash-row {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n}\n.panel-slider-hash {\n  position: absolute;\n  top: 50%;\n  height: 6px;\n  width: 1px;\n  transform: translateY(-50%);\n  border-radius: 999px;\n  background: transparent;\n  transition: background-color 200ms ease;\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-hash,\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-hash { background: var(--panel-hash); }\n\n.panel-slider-fill {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  width: var(--panel-fill-pct, 0%);\n  pointer-events: none;\n  background: var(--panel-surface-idle-fill);\n  transition: background-color 150ms ease, width 220ms cubic-bezier(0.2, 0, 0, 1);\n}\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-fill {\n  transition: background-color 150ms ease, width 0ms;\n  background: var(--panel-surface-active);\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-fill { background: var(--panel-surface-active); }\n\n.panel-slider-handle {\n  position: absolute;\n  top: 50%;\n  height: 12px;\n  width: 3px;\n  left: var(--panel-handle-left, 0%);\n  border-radius: 999px;\n  pointer-events: none;\n  background: var(--panel-handle);\n  opacity: 0;\n  transform: translate(-1.5px, -50%) scaleY(1);\n  transform-origin: center center;\n  transition:\n    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    left 220ms cubic-bezier(0.2, 0, 0, 1);\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-handle { opacity: 0.5; }\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-handle {\n  opacity: 0.9;\n  transform: translate(-1.5px, -50%) scaleY(1.3);\n  transition:\n    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),\n    left 0ms;\n}\n\n.panel-slider-label {\n  position: absolute;\n  left: 8px;\n  top: 50%;\n  transform: translateY(-50%);\n  pointer-events: none;\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n}\n.panel-slider-value {\n  position: absolute;\n  right: 8px;\n  top: 50%;\n  transform: translateY(-50%);\n  pointer-events: none;\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  transition: color 150ms ease;\n}\n.panel-slider[data-panel-state=\"hover\"] .panel-slider-value,\n.panel-slider[data-panel-state=\"drag\"] .panel-slider-value { color: var(--panel-label-active); }\n\n.panel-color {\n  display: flex;\n  height: 24px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  border-radius: 4px;\n  padding: 0 8px;\n  background: var(--panel-surface);\n}\n.panel-color-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n}\n.panel-color-right {\n  position: relative;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.panel-color-text {\n  width: 7ch;\n  background: transparent;\n  border: 0;\n  outline: 0;\n  text-align: right;\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  text-transform: uppercase;\n}\n.panel-color-swatch {\n  height: 16px;\n  width: 16px;\n  flex-shrink: 0;\n  border-radius: 4px;\n  border: 1px solid var(--panel-swatch-border);\n  transition: transform 150ms ease;\n}\n.panel-color-swatch:hover { transform: scale(1.1); }\n\n.panel-path {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-path-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n.panel-path-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n}\n.panel-path-head-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n.panel-path-count {\n  font-size: 11px;\n  color: var(--panel-muted-icon);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n}\n[data-panel] .panel-path-clear {\n  font-size: 11px;\n  font-weight: 400;\n  padding: 3px 8px;\n  border-radius: 4px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  cursor: pointer;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-path-clear:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n.panel-path-pad {\n  display: block;\n  width: 100%;\n  aspect-ratio: 1;\n  border-radius: 4px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-surface);\n  touch-action: none;\n  cursor: crosshair;\n  overflow: visible;\n}\n.panel-path-bg {\n  fill: transparent;\n  cursor: crosshair;\n}\n.panel-path-grid {\n  stroke: var(--panel-divider);\n  stroke-width: 0.5;\n}\n.panel-path-frame {\n  fill: none;\n  stroke: var(--panel-border);\n  stroke-width: 0.5;\n}\n.panel-path-line {\n  fill: none;\n  stroke: var(--panel-handle);\n  stroke-width: 1;\n  stroke-linejoin: round;\n  stroke-linecap: round;\n  opacity: 0.55;\n}\n.panel-path-line-close {\n  stroke: var(--panel-handle);\n  stroke-width: 0.8;\n  stroke-dasharray: 2 2;\n  opacity: 0.3;\n}\n.panel-path-anchor circle {\n  fill: none;\n  stroke: var(--panel-handle);\n  stroke-width: 1;\n  opacity: 0.7;\n}\n.panel-path-anchor.is-draggable {\n  cursor: grab;\n}\n.panel-path-anchor.is-draggable .panel-path-point-hit {\n  cursor: grab;\n}\n.panel-path-anchor.is-draggable:active {\n  cursor: grabbing;\n}\n.panel-path-anchor.is-selected circle:not(.panel-path-point-hit) {\n  stroke-width: 1.4;\n  opacity: 1;\n}\n.panel-path-anchor .panel-path-anchor-dot {\n  fill: var(--panel-handle);\n  stroke: none;\n  opacity: 0.9;\n}\n.panel-path-point {\n  cursor: grab;\n}\n.panel-path-point:active {\n  cursor: grabbing;\n}\n.panel-path-point-hit {\n  fill: transparent;\n}\n.panel-path-point-ring {\n  fill: var(--panel-bg);\n  stroke: var(--panel-handle);\n  stroke-width: 1.2;\n  transition: r 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-path-point.is-selected .panel-path-point-ring {\n  fill: var(--panel-handle);\n}\n.panel-path-point-num {\n  fill: var(--panel-label);\n  font-size: 3.4px;\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  text-anchor: middle;\n  pointer-events: none;\n  user-select: none;\n}\n.panel-path-point.is-selected .panel-path-point-num {\n  fill: var(--panel-bg);\n}\n.panel-path-selected {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  font-size: 11px;\n  color: var(--panel-text-muted);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n}\n[data-panel] .panel-path-remove {\n  font-size: 11px;\n  font-weight: 400;\n  padding: 3px 8px;\n  border-radius: 4px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  cursor: pointer;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-path-remove:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n.panel-path-hint {\n  font-size: 11px;\n  color: var(--panel-muted-icon);\n  text-align: center;\n}\n\n.panel-image {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-image-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n}\n.panel-image-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n}\n.panel-image-upload {\n  font-size: 11px;\n  font-weight: 400;\n  padding: 3px 8px;\n  border-radius: 4px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  cursor: pointer;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n.panel-image-upload:hover {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n.panel-image-frame {\n  position: relative;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  min-height: 48px;\n  border-radius: 4px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-surface);\n  overflow: hidden;\n  transition: border-color 150ms ease, background-color 150ms ease;\n}\n.panel-image-frame[data-panel-interactive=\"true\"] { cursor: pointer; }\n.panel-image-frame[data-panel-interactive=\"true\"]:hover,\n.panel-image-frame[data-panel-drag=\"true\"] {\n  border-color: var(--panel-handle);\n  background: var(--panel-surface-active);\n}\n.panel-image-preview {\n  display: block;\n  width: 75%;\n  height: auto;\n  border-radius: 4px;\n}\n.panel-image-empty {\n  font-size: 11px;\n  color: var(--panel-muted-icon);\n  padding: 14px 0;\n}\n.panel-image-native {\n  position: absolute;\n  height: 0;\n  width: 0;\n  opacity: 0;\n  pointer-events: none;\n}\n\n/* Scoped under [data-panel] so it beats the global button reset\n   (which zeroes padding/background). The negative margin + matching padding\n   full-bleeds the hover highlight ~8px past the label on each side, so the\n   label stays aligned with the other rows but the highlight never touches its\n   left edge. */\n[data-panel] .panel-toggle {\n  display: flex;\n  height: 24px;\n  width: calc(100% + 16px);\n  margin: 0 -8px;\n  align-items: center;\n  justify-content: space-between;\n  border-radius: 4px;\n  padding: 0 8px;\n  background: transparent;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-toggle:hover { background: var(--panel-toggle-hover); }\n.panel-toggle-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n}\n.panel-toggle-track {\n  position: relative;\n  width: 26px;\n  height: 14px;\n  border-radius: 999px;\n  background: var(--panel-surface-idle-fill);\n  transition: background-color 200ms cubic-bezier(0.32, 0.72, 0, 1);\n  flex-shrink: 0;\n}\n.panel-toggle[data-panel-on=\"true\"] .panel-toggle-track {\n  background: var(--panel-handle);\n}\n.panel-toggle-thumb {\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 10px;\n  height: 10px;\n  border-radius: 999px;\n  background: var(--panel-bg);\n  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n.panel-toggle[data-panel-on=\"false\"] .panel-toggle-thumb {\n  background: var(--panel-handle);\n}\n.panel-toggle[data-panel-on=\"true\"] .panel-toggle-thumb {\n  transform: translateX(12px);\n}\n\n/* Segmented single-select \u2014 optional label, then option buttons sharing a\n   surface track. Selected uses the panel surface tokens, not a heavy fill. */\n.panel-toggle-group {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  width: 100%;\n  padding: 4px 0;\n}\n.panel-toggle-group-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  line-height: 1.35;\n  padding: 0 2px;\n}\n.panel-toggle-group-track {\n  display: flex;\n  align-items: stretch;\n  gap: 2px;\n  padding: 2px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n}\n[data-panel] .panel-toggle-group-btn {\n  display: inline-flex;\n  flex: 1 1 0;\n  min-width: 0;\n  height: 20px;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  border-radius: 2px;\n  padding: 0 8px;\n  color: var(--panel-text-muted);\n  font-family: inherit;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1;\n  cursor: pointer;\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-toggle-group-icon {\n  display: inline-flex;\n  flex-shrink: 0;\n}\n.panel-toggle-group-icon svg {\n  width: 12px;\n  height: 12px;\n  display: block;\n}\n.panel-toggle-group-text {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n[data-panel] .panel-toggle-group-btn:hover {\n  color: var(--panel-action-text-hover);\n  background: var(--panel-toggle-hover);\n}\n[data-panel] .panel-toggle-group-btn:focus-visible {\n  outline: 1px solid var(--panel-handle);\n  outline-offset: -1px;\n}\n[data-panel] .panel-toggle-group-btn[data-panel-active=\"true\"] {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-toggle-group-btn:active { transform: scale(0.98); }\n@media (prefers-reduced-motion: reduce) {\n  [data-panel] .panel-toggle-group-btn { transition: none; }\n  [data-panel] .panel-toggle-group-btn:active { transform: none; }\n}\n\n.panel-select {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  background: transparent;\n}\n.panel-select[data-panel-layout=\"inline\"] {\n  min-height: 24px;\n  height: 24px;\n  border-radius: 4px;\n  padding: 0 8px;\n  background: var(--panel-surface);\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-select[data-panel-layout=\"inline\"]:hover {\n  background: var(--panel-surface-active);\n}\n.panel-select[data-panel-layout=\"stacked\"] {\n  flex-direction: column;\n  align-items: stretch;\n  gap: 6px;\n  min-height: 0;\n  height: auto;\n  padding: 0;\n  background: transparent;\n}\n.panel-select-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  min-width: 0;\n  line-height: 1.35;\n}\n.panel-select[data-panel-layout=\"stacked\"] .panel-select-label {\n  white-space: normal;\n}\n.panel-select[data-panel-layout=\"inline\"] .panel-select-label {\n  flex: 1 1 auto;\n  white-space: normal;\n}\n[data-panel] .panel-select-btn {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  flex-shrink: 0;\n  border: 0;\n  outline: 0;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: normal;\n  cursor: pointer;\n  height: 24px;\n  min-height: 24px;\n  padding: 0 8px;\n  border-radius: 4px;\n  overflow: visible;\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-select[data-panel-layout=\"stacked\"] .panel-select-btn {\n  align-self: stretch;\n  width: 100%;\n  max-width: none;\n  justify-content: space-between;\n}\n.panel-select[data-panel-layout=\"inline\"] .panel-select-btn {\n  align-self: center;\n  flex: 1 1 auto;\n  max-width: none;\n  height: 100%;\n  justify-content: flex-end;\n  padding: 0;\n  background: transparent;\n  border-radius: 0;\n}\n.panel-select[data-panel-layout=\"inline\"] .panel-select-btn:hover,\n.panel-select[data-panel-layout=\"inline\"] .panel-select-btn:focus-visible {\n  background: transparent;\n}\n/* Ellipsis horizontally only \u2014 vertical overflow clips descenders in custom fonts. */\n.panel-select-value {\n  min-width: 0;\n  overflow-x: hidden;\n  overflow-y: visible;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  line-height: 1.35;\n}\n[data-panel] .panel-select-btn:hover {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-select-btn:focus-visible {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n  outline: 1px solid var(--panel-handle);\n  outline-offset: 1px;\n}\n[data-panel] .panel-select-btn:active { transform: none; }\n.panel-select[data-panel-layout=\"stacked\"] .panel-select-btn:active {\n  transform: none;\n}\n.panel-select-chevron {\n  width: 12px;\n  height: 12px;\n  opacity: 0.6;\n  flex-shrink: 0;\n}\n.panel-select-layer {\n  position: fixed;\n  inset: 0;\n  z-index: 10000;\n  pointer-events: none;\n}\n.panel-select-menu {\n  pointer-events: auto;\n  overflow-y: auto;\n  padding: 4px;\n  border-radius: 6px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  box-shadow: 0 1px 2px rgb(0 0 0 / 0.28), 0 12px 32px rgb(0 0 0 / 0.32);\n  scrollbar-width: thin;\n  scrollbar-color: var(--panel-scrollbar-thumb) transparent;\n  animation: panel-menu-in 160ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-select-menu[data-panel-up=\"true\"] {\n  animation-name: panel-menu-in-up;\n}\n@keyframes panel-menu-in {\n  from {\n    opacity: 0;\n    transform: translate(-100%, 0) translateY(-4px);\n    filter: blur(2px);\n  }\n  to {\n    opacity: 1;\n    transform: translate(-100%, 0) translateY(0);\n    filter: blur(0);\n  }\n}\n@keyframes panel-menu-in-up {\n  from {\n    opacity: 0;\n    transform: translate(-100%, -100%) translateY(4px);\n    filter: blur(2px);\n  }\n  to {\n    opacity: 1;\n    transform: translate(-100%, -100%) translateY(0);\n    filter: blur(0);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .panel-select-menu { animation: none; }\n}\n[data-panel] .panel-select-option {\n  display: flex;\n  width: 100%;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  border: 0;\n  background: transparent;\n  color: var(--panel-label);\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1.2;\n  text-align: left;\n  white-space: nowrap;\n  min-height: 24px;\n  padding: 0 8px;\n  border-radius: 4px;\n  cursor: pointer;\n  transition: background-color 120ms cubic-bezier(0.22, 1, 0.36, 1),\n    color 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-select-option[data-panel-active=\"true\"] {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-select-option[aria-selected=\"true\"] {\n  color: var(--panel-text);\n}\n.panel-select-check {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  opacity: 0.9;\n}\n\n.panel-prompt {\n  display: flex;\n  flex-direction: column;\n}\n/* Bumped under [data-panel] so it ties the button reset on specificity\n   and wins on source order \u2014 the reset sets padding: 0 globally. */\n[data-panel] .panel-prompt-toggle {\n  display: flex;\n  height: 24px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 11px;\n  font-weight: 400;\n  text-align: left;\n  transition: color 150ms ease;\n}\n[data-panel] .panel-prompt-toggle:hover,\n.panel-prompt[data-panel-open=\"true\"] .panel-prompt-toggle {\n  color: var(--panel-label-active);\n}\n.panel-prompt-label {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  min-width: 0;\n}\n.panel-prompt-caret {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  transition: transform 200ms ease;\n}\n.panel-prompt[data-panel-open=\"true\"] .panel-prompt-caret { transform: rotate(180deg); }\n\n.panel-prompt-preview {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 6px 0 2px;\n}\n.panel-prompt-desc {\n  font-size: 11px;\n  color: var(--panel-text-muted);\n  line-height: 1.4;\n  padding: 0 4px;\n}\n.panel-prompt-code-wrap {\n  position: relative;\n}\n.panel-prompt-pre {\n  margin: 0;\n  padding: 8px 8px 20px;\n  background: var(--panel-surface);\n  color: var(--panel-text);\n  border: 0;\n  border-radius: 4px;\n  font-family: inherit;\n  font-size: 11px;\n  line-height: 1.5;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 140px;\n  overflow-y: auto;\n  scrollbar-width: thin;\n  scrollbar-color: var(--panel-scrollbar-thumb) transparent;\n  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);\n  mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);\n}\n.panel-prompt-pre::-webkit-scrollbar { width: 6px; }\n.panel-prompt-pre::-webkit-scrollbar-thumb { background: var(--panel-scrollbar-thumb); border-radius: 999px; }\n/* Scoped under [data-panel] to beat the global button reset\n   (background: transparent) on specificity \u2014 otherwise the button is\n   transparent and the prompt text shows through behind the icon. */\n[data-panel] .panel-prompt-copy {\n  position: absolute;\n  bottom: 6px;\n  right: 6px;\n  width: 22px;\n  height: 22px;\n  border-radius: 4px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--panel-bg);\n  color: var(--panel-label);\n  border: 1px solid var(--panel-border);\n  transition: color 150ms ease, transform 200ms cubic-bezier(0.34, 1.16, 0.64, 1);\n}\n.panel-prompt-copy svg { width: 12px; height: 12px; }\n[data-panel] .panel-prompt-copy:hover {\n  background: var(--panel-surface-active);\n  color: var(--panel-label-active);\n  transform: scale(1.05);\n}\n\n.panel-vec2 {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-vec2-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  padding: 0 8px;\n}\n.panel-vec2-row {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 6px;\n}\n\n/* \u2500\u2500 Preset selector \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-presets {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 0 0 2px;\n}\n.panel-presets-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  padding: 0 8px;\n}\n[data-panel] .panel-preset-select {\n  appearance: none;\n  -webkit-appearance: none;\n  width: 100%;\n  height: 24px;\n  border: 0;\n  border-radius: 4px;\n  padding: 0 24px 0 8px;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1;\n  color: var(--panel-label);\n  background:\n    linear-gradient(45deg, transparent 50%, var(--panel-muted-icon) 50%),\n    linear-gradient(135deg, var(--panel-muted-icon) 50%, transparent 50%),\n    var(--panel-surface);\n  background-position: calc(100% - 12px) 50%, calc(100% - 8px) 50%, 0 0;\n  background-size: 4px 4px, 4px 4px, auto;\n  background-repeat: no-repeat;\n  cursor: pointer;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-preset-select:hover {\n  color: var(--panel-label-active);\n  background-color: var(--panel-surface-active);\n}\n[data-panel] .panel-preset-select:focus-visible {\n  outline: 1px solid var(--panel-handle);\n  outline-offset: 1px;\n}\n\n/* \u2500\u2500 ToolShell layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-tool-shell {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n}\n.panel-tool-viewport {\n  position: absolute;\n  inset: 0;\n  z-index: 0;\n}\n.panel-tool-overlay {\n  pointer-events: none;\n  position: absolute;\n  inset: 0;\n  z-index: 20;\n  transition: opacity 500ms ease;\n}\n.panel-tool-overlay[data-panel-ui-visible=\"false\"] {\n  opacity: 0;\n}\n.panel-tool-topbar {\n  pointer-events: none;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding-top: 16px;\n  padding-bottom: 16px;\n  transition: padding 300ms ease;\n}\n.panel-tool-topbar > * {\n  pointer-events: auto;\n}\n.panel-tool-panels {\n  pointer-events: none;\n  position: absolute;\n  inset: 0;\n}\n\n.panel-panel-toggle {\n  pointer-events: auto;\n  position: absolute;\n  bottom: 20px;\n  z-index: 30;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 8px;\n  background: var(--panel-bg);\n  color: var(--panel-text-muted);\n  box-shadow: var(--panel-shadow);\n  transition: left 300ms ease, right 300ms ease, background 150ms ease, color 150ms ease;\n}\n.panel-panel-toggle:hover {\n  background: var(--panel-surface);\n  color: var(--panel-text);\n}\n.panel-panel-toggle-icon {\n  width: 16px;\n  height: 16px;\n  transition: transform 300ms ease;\n}\n\n/* \u2500\u2500 Canvas overlay projector (OFF-138) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n/* A single layer pinned over the canvas. Click-through by default so it never\n   eats canvas pointer events; individual overlay items opt back in if needed.\n   overflow: visible so items projected near the edges are not clipped. */\n.panel-overlay-layer {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  overflow: visible;\n}\n/* Each projected node. Positioned via transform only (translate \u2192 the screen\n   point, then -50%/-50% to center). will-change hints the compositor; no\n   layout-thrashing properties are ever written. */\n.panel-overlay-item {\n  position: absolute;\n  top: 0;\n  left: 0;\n  will-change: transform;\n}\n\n.panel-eye-toggle {\n  pointer-events: auto;\n  position: absolute;\n  bottom: 20px;\n  left: 50%;\n  z-index: 30;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border-radius: 999px;\n  background: var(--panel-bg);\n  color: var(--panel-text-muted);\n  box-shadow: var(--panel-shadow);\n  transform: translateX(-50%);\n  transition: background 150ms ease, color 500ms ease, opacity 500ms ease;\n}\n.panel-eye-toggle[data-panel-visible=\"false\"] {\n  color: color-mix(in srgb, var(--panel-text-muted) 30%, transparent);\n}\n.panel-eye-toggle:hover {\n  background: var(--panel-surface);\n  color: var(--panel-text);\n}\n.panel-eye-toggle svg {\n  width: 16px;\n  height: 16px;\n}\n\n/* \u2500\u2500 Disclosure rows (POI / caption editors) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-disclosure {\n  display: flex;\n  flex-direction: column;\n}\n.panel-disclosure[data-panel-open=\"true\"] {\n  margin-bottom: 10px;\n}\n.panel-disclosure[data-panel-dimmed=\"true\"] {\n  opacity: 0.38;\n  pointer-events: none;\n}\n.panel-disclosure[data-panel-highlight=\"true\"] .panel-disclosure-toggle {\n  box-shadow: inset 0 0 0 1px var(--panel-handle);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-disclosure-toggle {\n  display: flex;\n  height: 24px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 11px;\n  font-weight: 400;\n  text-align: left;\n  transition: color 150ms ease, background-color 150ms ease;\n}\n[data-panel] .panel-disclosure-toggle:hover,\n.panel-disclosure[data-panel-open=\"true\"] .panel-disclosure-toggle {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n.panel-disclosure-label {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  min-width: 0;\n}\n.panel-disclosure-caret {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  transition: transform 200ms ease;\n}\n.panel-disclosure[data-panel-open=\"true\"] .panel-disclosure-caret {\n  transform: rotate(180deg);\n}\n.panel-disclosure-body {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 6px 0 12px;\n}\n/* Nested editors \u2014 damp hover scale so sliders don't spill past inset padding. */\n[data-panel] .panel-disclosure-body .panel-slider,\n[data-panel] .panel-vec2-row .panel-slider {\n  width: 100%;\n  margin: 0;\n}\n[data-panel] .panel-disclosure-body .panel-slider[data-panel-state=\"hover\"],\n[data-panel] .panel-vec2-row .panel-slider[data-panel-state=\"hover\"] {\n  transform: none;\n}\n[data-panel] .panel-disclosure-body .panel-slider[data-panel-state=\"drag\"],\n[data-panel] .panel-vec2-row .panel-slider[data-panel-state=\"drag\"] {\n  transform: scale(1.008);\n}\n[data-panel] .panel-disclosure-body .panel-toggle {\n  width: 100%;\n  margin: 0;\n}\n\n/* \u2500\u2500 Collection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-collection {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n.panel-collection-header {\n  display: flex;\n  height: 24px;\n  align-items: center;\n  gap: 8px;\n}\n.panel-collection-title {\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: -0.01em;\n  color: var(--panel-text);\n}\n.panel-collection-count {\n  display: inline-flex;\n  min-width: 16px;\n  height: 16px;\n  align-items: center;\n  justify-content: center;\n  padding: 0 5px;\n  border-radius: 999px;\n  background: var(--panel-surface);\n  font-size: 11px;\n  font-weight: 400;\n  font-variant-numeric: tabular-nums;\n  color: var(--panel-text-muted);\n}\n[data-panel] .panel-collection-add {\n  margin-left: auto;\n  height: 20px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  font-size: 11px;\n  font-weight: 400;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-collection-add:hover:not(:disabled) {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-collection-add:active:not(:disabled) {\n  transform: scale(0.98);\n}\n[data-panel] .panel-collection-add:disabled {\n  opacity: 0.4;\n  cursor: not-allowed;\n}\n.panel-collection-items {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-collection-empty {\n  padding: 6px 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  font-size: 11px;\n  color: var(--panel-text-muted);\n}\n.panel-collection-row {\n  display: flex;\n  flex-direction: column;\n  border-radius: 4px;\n  transition: opacity 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-collection-row[data-panel-dragging=\"true\"] {\n  opacity: 0.5;\n}\n.panel-collection-row[data-panel-dragover=\"true\"] {\n  box-shadow: inset 0 0 0 1px var(--panel-handle);\n}\n.panel-collection-row-head {\n  display: flex;\n  height: 24px;\n  align-items: center;\n  gap: 4px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  padding: 0 4px 0 6px;\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-collection-row[data-panel-open=\"true\"] .panel-collection-row-head {\n  background: var(--panel-surface-active);\n}\n.panel-collection-drag {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 18px;\n  height: 18px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  cursor: grab;\n}\n.panel-collection-drag:active {\n  cursor: grabbing;\n}\n.panel-collection-drag svg {\n  width: 12px;\n  height: 12px;\n}\n[data-panel] .panel-collection-row-toggle {\n  display: flex;\n  flex: 1;\n  min-width: 0;\n  height: 24px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 0 4px;\n  background: transparent;\n  color: var(--panel-label);\n  font-size: 11px;\n  font-weight: 400;\n  text-align: left;\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-collection-row-toggle:hover,\n.panel-collection-row[data-panel-open=\"true\"] .panel-collection-row-toggle {\n  color: var(--panel-label-active);\n}\n.panel-collection-row-label {\n  min-width: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-collection-caret {\n  width: 12px;\n  height: 12px;\n  flex-shrink: 0;\n  color: var(--panel-muted-icon);\n  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n.panel-collection-row[data-panel-open=\"true\"] .panel-collection-caret {\n  transform: rotate(180deg);\n}\n[data-panel] .panel-collection-remove {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 20px;\n  height: 20px;\n  flex-shrink: 0;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--panel-muted-icon);\n  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),\n    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-collection-remove:hover:not(:disabled) {\n  color: var(--panel-danger);\n  background: var(--panel-surface);\n}\n[data-panel] .panel-collection-remove:active:not(:disabled) {\n  transform: scale(0.98);\n}\n[data-panel] .panel-collection-remove:disabled {\n  opacity: 0.3;\n  cursor: not-allowed;\n}\n.panel-collection-remove svg {\n  width: 12px;\n  height: 12px;\n}\n.panel-collection-row-body {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 6px 8px 10px;\n}\n\n/* \u2500\u2500 Reference \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-reference {\n  display: flex;\n  flex-direction: column;\n}\n[data-panel] .panel-reference-trigger {\n  display: block;\n  width: 100%;\n  padding: 0;\n  background: transparent;\n  text-align: left;\n  transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-reference-trigger:active {\n  transform: scale(0.98);\n}\n[data-panel] .panel-reference-trigger .panel-readout {\n  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n[data-panel] .panel-reference-trigger:hover .panel-readout {\n  background: var(--panel-surface-active);\n}\n.panel-reference-picker {\n  padding-top: 6px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .panel-collection-add,\n  .panel-collection-remove,\n  .panel-collection-caret,\n  .panel-collection-row,\n  .panel-collection-row-head,\n  .panel-collection-row-toggle,\n  .panel-reference-trigger,\n  .panel-reference-trigger .panel-readout {\n    transition: none;\n  }\n}\n\n/* \u2500\u2500 Text input \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-text {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-text[data-panel-layout=\"inline\"] {\n  flex-direction: row;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-height: 24px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n}\n.panel-text-label,\n.panel-search-label,\n.panel-textarea-label {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n  padding: 0;\n  line-height: 1.35;\n}\n.panel-text[data-panel-layout=\"inline\"] .panel-text-label {\n  padding: 0;\n  flex-shrink: 0;\n}\n[data-panel] .panel-text-input {\n  width: 100%;\n  height: 24px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1.2;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n.panel-text[data-panel-layout=\"inline\"] .panel-text-input {\n  flex: 1;\n  min-width: 0;\n  padding: 0;\n  height: 100%;\n  background: transparent;\n  text-align: right;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.panel-text[data-panel-layout=\"inline\"] .panel-text-input:focus {\n  background: transparent;\n}\n[data-panel] .panel-text-input[data-panel-mono=\"true\"] {\n  font-family: inherit;\n  font-variant-numeric: tabular-nums;\n  font-size: 11px;\n}\n[data-panel] .panel-text-input:focus {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-text-input::placeholder {\n  color: var(--panel-muted-icon);\n  text-transform: none;\n}\n\n/* \u2500\u2500 Textarea \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-textarea {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n[data-panel] .panel-textarea-input {\n  width: 100%;\n  min-height: 72px;\n  resize: vertical;\n  padding: 6px 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-family: inherit;\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1.45;\n  outline: none;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-textarea-input:focus {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-textarea-input::placeholder {\n  color: var(--panel-muted-icon);\n}\n\n.panel-search {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-search-row {\n  display: flex;\n  align-items: stretch;\n  gap: 6px;\n}\n[data-panel] .panel-search-input {\n  flex: 1;\n  min-width: 0;\n  height: 24px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-label);\n  font-size: 11px;\n  font-weight: 400;\n  line-height: 1.2;\n  transition: background-color 150ms ease, color 150ms ease;\n}\n[data-panel] .panel-search-input:focus {\n  color: var(--panel-label-active);\n  background: var(--panel-surface-active);\n}\n[data-panel] .panel-search-input::placeholder {\n  color: var(--panel-muted-icon);\n}\n[data-panel] .panel-search-btn {\n  flex-shrink: 0;\n  height: 24px;\n  padding: 0 8px;\n  border-radius: 4px;\n  background: var(--panel-action-bg);\n  color: var(--panel-action-text);\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.01em;\n  transition: background-color 150ms ease, color 150ms ease, transform 120ms ease;\n}\n[data-panel] .panel-search-btn:hover:not(:disabled) {\n  background: var(--panel-action-bg-hover);\n  color: var(--panel-action-text-hover);\n}\n[data-panel] .panel-search-btn:active:not(:disabled) {\n  transform: scale(0.98);\n}\n[data-panel] .panel-search-btn:disabled {\n  opacity: 0.55;\n  cursor: not-allowed;\n}\n.panel-search-error {\n  padding: 0 8px;\n  font-size: 11px;\n  line-height: 1.35;\n  color: #ef4444;\n}\n\n/* \u2500\u2500 Readout row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-readout {\n  display: flex;\n  min-height: 24px;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 4px 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n}\n.panel-readout-label {\n  flex-shrink: 0;\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--panel-label);\n}\n.panel-readout-value {\n  min-width: 0;\n  font-size: 11px;\n  font-weight: 400;\n  font-variant-numeric: tabular-nums;\n  color: var(--panel-text-muted);\n  text-align: right;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* \u2500\u2500 Option list (search results, pickers) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-option-list-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.panel-option-list-title {\n  padding: 0 8px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  color: var(--panel-text-muted);\n}\n.panel-option-list {\n  display: flex;\n  max-height: 168px;\n  flex-direction: column;\n  gap: 2px;\n  overflow-y: auto;\n  padding: 4px;\n  border-radius: 6px;\n  border: 1px solid var(--panel-border);\n  background: var(--panel-bg);\n  scrollbar-width: thin;\n  scrollbar-color: var(--panel-scrollbar-thumb) transparent;\n}\n.panel-option-list::-webkit-scrollbar {\n  width: 6px;\n}\n.panel-option-list::-webkit-scrollbar-thumb {\n  background: var(--panel-scrollbar-thumb);\n  border-radius: 999px;\n}\n[data-panel] .panel-option-item {\n  display: flex;\n  width: 100%;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 2px;\n  padding: 6px 8px;\n  border-radius: 4px;\n  background: transparent;\n  color: var(--panel-label);\n  text-align: left;\n  transition: background-color 120ms ease, color 120ms ease;\n}\n[data-panel] .panel-option-item:hover:not(:disabled) {\n  background: var(--panel-surface);\n  color: var(--panel-label-active);\n}\n[data-panel] .panel-option-item:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n.panel-option-item-label {\n  width: 100%;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 1.3;\n  color: inherit;\n}\n.panel-option-item-desc {\n  width: 100%;\n  font-size: 11px;\n  line-height: 1.35;\n  color: var(--panel-text-muted);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n.panel-option-empty {\n  padding: 6px 8px;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  font-size: 11px;\n  line-height: 1.35;\n  color: var(--panel-text-muted);\n}\n\n/* \u2500\u2500 Hint copy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.panel-hint {\n  margin: 0;\n  padding: 0 8px 2px;\n  font-size: 11px;\n  line-height: 1.4;\n  color: var(--panel-text-muted);\n}\n";

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

interface ColorLibraryColor {
    label: string;
    hex: string;
    p3?: string;
    oklch?: string;
}
interface ColorLibraryGroup {
    name: string;
    colors: ColorLibraryColor[];
}
interface ColorPopoverProps {
    color: string;
    onChange: (hex: string) => void;
    /** Named swatch groups for the Library tab; picker-only when absent. */
    library?: ColorLibraryGroup[];
    disabled?: boolean;
    ariaLabel?: string;
    triggerClassName?: string;
    triggerStyle?: CSSProperties;
    children?: ReactNode;
}
/**
 * Dark color popover: Library/Picker tabs when a `library` is given,
 * picker-only otherwise. Portals to <body>, positions itself against the
 * trigger, and scales in from the anchored corner.
 */
declare function ColorPopover({ color, onChange, library, disabled, ariaLabel, triggerClassName, triggerStyle, children, }: ColorPopoverProps): react.JSX.Element;
/**
 * Styles for the color popover, kept separate so the injector can compose
 * them with the base panel CSS. All classes are `.panel-color-pop*` prefixed.
 */
declare const colorPopoverStyles = "\n.panel-color-pop {\n  position: fixed;\n  z-index: 2147483647;\n  display: flex;\n  flex-direction: column;\n  width: 224px;\n  overflow: hidden;\n  border-radius: 6px;\n  border: 1px solid #2e2e2e;\n  background: #1c1c1c;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28), 0 12px 32px rgba(0, 0, 0, 0.32);\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n  color: #d4d4d4;\n}\n\n.panel-color-pop-tabs {\n  display: flex;\n  flex: none;\n  margin: 8px;\n  border-radius: 6px;\n  background: #2a2a2a;\n  padding: 2px;\n}\n\n.panel-color-pop-spacer {\n  flex: none;\n  height: 8px;\n}\n\n.panel-color-pop-tab {\n  flex: 1;\n  cursor: pointer;\n  border: 0;\n  border-radius: 4px;\n  background: transparent;\n  padding: 4px 8px;\n  font-family: inherit;\n  font-size: 11px;\n  font-weight: 500;\n  text-transform: capitalize;\n  color: #8f8f8f;\n  transition: color 150ms ease, background-color 150ms ease;\n}\n\n.panel-color-pop-tab:hover { color: #d4d4d4; }\n\n.panel-color-pop-tab[aria-selected=\"true\"] {\n  background: #3a3a3a;\n  color: #f0f0f0;\n}\n\n.panel-color-pop-picker {\n  display: flex;\n  flex: none;\n  flex-direction: column;\n  gap: 8px;\n  padding: 0 8px 8px;\n}\n\n.panel-color-pop-canvas {\n  display: flex;\n  width: 200px;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.panel-color-pop-sat {\n  position: relative;\n  height: 164px;\n  width: 200px;\n  cursor: crosshair;\n  touch-action: none;\n  overflow: hidden;\n  border: 0;\n  border-radius: 8px;\n  padding: 0;\n  background-image: linear-gradient(0deg, #000, transparent),\n    linear-gradient(90deg, #fff, rgba(255, 255, 255, 0));\n  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);\n}\n\n.panel-color-pop-hue {\n  position: relative;\n  height: 24px;\n  width: 200px;\n  cursor: ew-resize;\n  touch-action: none;\n  border: 0;\n  border-radius: 0 0 8px 8px;\n  padding: 0;\n  background: linear-gradient(90deg, red 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, red 100%);\n}\n\n.panel-color-pop-thumb {\n  pointer-events: none;\n  position: absolute;\n  height: 28px;\n  width: 28px;\n  border-radius: 9999px;\n  border: 2px solid #ffffff;\n  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);\n  transform: translate(-50%, -50%);\n}\n\n.panel-color-pop-thumb-hue { top: 50%; }\n\n.panel-color-pop-hex {\n  display: flex;\n  align-items: center;\n  border: 1px solid #2e2e2e;\n  border-radius: 4px;\n  padding: 4px 8px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11px;\n  color: #d4d4d4;\n}\n\n.panel-color-pop-hex input {\n  width: 100%;\n  min-width: 0;\n  border: 0;\n  background: transparent;\n  outline: none;\n  font: inherit;\n  color: inherit;\n  text-transform: uppercase;\n}\n\n/* Animatable fade heights for the list's cut-off masks. */\n@property --panel-color-pop-fade-top {\n  syntax: \"<length>\";\n  inherits: false;\n  initial-value: 0px;\n}\n\n@property --panel-color-pop-fade-bottom {\n  syntax: \"<length>\";\n  inherits: false;\n  initial-value: 0px;\n}\n\n/* Full-bleed scroller with its padding inside, thin scrollbar, and fades on\n   whichever end is clipped (data-fade-top / data-fade-bottom are set from\n   the component's scroll handler). */\n.panel-color-pop-list {\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  gap: 8px;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  padding: 0 8px 8px;\n  scrollbar-width: thin;\n  scrollbar-color: rgb(255 255 255 / 0.25) transparent;\n  mask-image: linear-gradient(\n    to bottom,\n    transparent 0,\n    black var(--panel-color-pop-fade-top),\n    black calc(100% - var(--panel-color-pop-fade-bottom)),\n    transparent 100%\n  );\n  transition:\n    --panel-color-pop-fade-top 240ms cubic-bezier(0.22, 1, 0.36, 1),\n    --panel-color-pop-fade-bottom 240ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n.panel-color-pop-list[data-fade-top=\"true\"] { --panel-color-pop-fade-top: 32px; }\n.panel-color-pop-list[data-fade-bottom=\"true\"] { --panel-color-pop-fade-bottom: 40px; }\n\n.panel-color-pop-group {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n}\n\n.panel-color-pop-group-label {\n  padding: 2px 4px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.025em;\n  text-transform: uppercase;\n  color: #737373;\n}\n\n.panel-color-pop-item {\n  display: flex;\n  cursor: pointer;\n  align-items: center;\n  gap: 8px;\n  border: 0;\n  border-radius: 4px;\n  background: transparent;\n  padding: 4px;\n  text-align: left;\n  font-family: inherit;\n  transition: background-color 150ms ease;\n}\n\n.panel-color-pop-item:hover,\n.panel-color-pop-item-selected { background: #2a2a2a; }\n\n.panel-color-pop-item-swatch {\n  height: 20px;\n  width: 20px;\n  flex: none;\n  border-radius: 4px;\n  border: 1px solid #3a3a3a;\n}\n\n.panel-color-pop-item-selected .panel-color-pop-item-swatch {\n  border-color: #3b82f6;\n  box-shadow: 0 0 0 1px #3b82f6;\n}\n\n.panel-color-pop-item-label {\n  min-width: 0;\n  flex: 1;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 11px;\n  color: #d4d4d4;\n}\n\n.panel-color-pop-item-hex {\n  flex: none;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11px;\n  text-transform: uppercase;\n  color: #737373;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .panel-color-pop-list,\n  .panel-color-pop-tab,\n  .panel-color-pop-item { transition: none; }\n}\n";

interface ControlColorInputProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    /** Named swatch groups for the popover's Library tab; picker-only when absent. */
    library?: ColorLibraryGroup[];
    className?: string;
}
declare function ControlColorInput({ label, value, onChange, library, className, }: ControlColorInputProps): react.JSX.Element;

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

/**
 * 2D color-field gradient stops — shared math for the gradient-stops control.
 *
 * A stop is a colored hotspot on a unit plane; the field between stops is an
 * inverse-distance-weighted (power 2) blend. Saved 1D ramps (`offset` only)
 * round-trip through the same shape: `offset` is an alias of `x`.
 */
type GradientStop = {
    id: string;
    /** Horizontal UV (0 = left, 1 = right). */
    x: number;
    /** Vertical UV (0 = top, 1 = bottom). */
    y: number;
    /** Alias of `x` so saved 1D ramps round-trip. */
    offset: number;
    color: string;
};
declare const GRADIENT_STOP_MIN = 1;
declare const GRADIENT_STOP_MAX = 16;
declare function defaultGradientStops(colorFar?: string, colorNear?: string): GradientStop[];
declare function sortGradientStops(stops: readonly GradientStop[]): GradientStop[];
declare function serializeGradientStops(stops: readonly GradientStop[]): string;
/**
 * Canonicalize any saved shape — array of stops, serialized JSON string, or
 * garbage — into a valid stop list. Invalid input falls back to
 * `colorFar@(0,0.5) → colorNear@(1,0.5)`.
 */
declare function normalizeGradientStops(value: unknown, colorFar?: string, colorNear?: string): GradientStop[];
/** Inverse-distance weighting (power 2). An exact hotspot hit returns that color. */
declare function sampleGradientRgb(stops: readonly GradientStop[], x: number, y: number): {
    r: number;
    g: number;
    b: number;
};
/** 1D CSS ramp along stop offsets — used for the "ramp" layout preview. */
declare function gradientCss(stops: readonly GradientStop[]): string;
/** RGBA pixel buffer of the 2D field, row-major, for a canvas preview. */
declare function rasterizeGradientField(stops: readonly GradientStop[], width: number, height: number): Uint8ClampedArray;
declare function addGradientStop(stops: readonly GradientStop[], x?: number, y?: number, color?: string): GradientStop[];
declare function removeGradientStop(stops: readonly GradientStop[], id: string): GradientStop[];
declare function moveGradientStop(stops: readonly GradientStop[], id: string, x: number, y: number): GradientStop[];
/** Slide a ramp stop on X only, keeping its field Y position. */
declare function moveGradientStopOffset(stops: readonly GradientStop[], id: string, offset: number): GradientStop[];
declare function recolorGradientStop(stops: readonly GradientStop[], id: string, color: string): GradientStop[];

/**
 * Contract for an injectable color popover trigger. The gradient and stripe
 * controls stay decoupled from any concrete popover — the field renderer (or a
 * consumer) passes a renderer; without one, a native color-picker swatch is
 * used.
 */
type PanelColorPopoverProps = {
    color: string;
    onChange: (hex: string) => void;
    disabled?: boolean;
    ariaLabel?: string;
    triggerClassName?: string;
    triggerStyle?: CSSProperties;
    align?: "left" | "right";
};
type PanelColorPopoverRenderer = (props: PanelColorPopoverProps) => ReactNode;
/**
 * Fallback popover: a swatch button that opens the browser's native color
 * picker. Same trigger contract as an injected popover renderer.
 */
declare function NativeColorSwatch({ color, onChange, disabled, ariaLabel, triggerClassName, triggerStyle, }: PanelColorPopoverProps): react.JSX.Element;
type ControlGradientStopsLayout = "field" | "ramp";
interface ControlGradientStopsProps {
    stops: readonly GradientStop[];
    onChange: (stops: GradientStop[]) => void;
    disabled?: boolean;
    /** `field` (2D hotspot plane, default) or `ramp` (1D stop track). */
    layout?: ControlGradientStopsLayout;
    /** Header title. Defaults to "Field" / "Ramp" per layout. */
    label?: string;
    /** Named color library for token display on the selected stop. */
    library?: ColorLibrary;
    /** Injectable color popover; falls back to the native picker swatch. */
    renderColorPopover?: PanelColorPopoverRenderer;
    className?: string;
}
/**
 * Gradient stop editor: a preview canvas (2D IDW field) or ramp track with
 * draggable stops, add/remove actions, and a per-stop color swatch that opens
 * the injected color popover (or the native picker).
 */
declare function ControlGradientStops({ stops, onChange, disabled, layout, label, library, renderColorPopover, className, }: ControlGradientStopsProps): react.JSX.Element;
interface ControlLibraryColorProps {
    label: string;
    value: string | null;
    onChange: (hex: string | null) => void;
    /** Named color library — matching hexes display as `Group / Label` tokens. */
    library?: ColorLibrary;
    /** Show a clear (×) button and treat empty as transparent. */
    allowClear?: boolean;
    placeholder?: string;
    disabled?: boolean;
    renderColorPopover?: PanelColorPopoverRenderer;
    className?: string;
}
/**
 * Color row with library-token display: swatch (popover trigger) + a text
 * input that shows the library token for known hexes and accepts raw hex
 * entry. Ported from the site's color library input.
 */
declare function ControlLibraryColor({ label, value, onChange, library, allowClear, placeholder, disabled, renderColorPopover, className, }: ControlLibraryColorProps): react.JSX.Element;
/**
 * CSS for the gradient stops editor + library color row. Injected by the
 * package's style pipeline; exported so custom setups can inject it manually.
 */
declare const gradientStopsStyles = "\n.panel-gradient-editor {\n  display: grid;\n  gap: 8px;\n  width: 100%;\n  min-width: 0;\n  padding: 2px 0 6px;\n  font-size: 11px;\n  color: var(--panel-text);\n}\n\n.panel-gradient-editor.is-disabled {\n  pointer-events: none;\n  opacity: 0.45;\n}\n\n.panel-gradient-header {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.panel-gradient-title {\n  color: var(--panel-text-muted);\n  font-size: 10px;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n.panel-gradient-actions {\n  display: flex;\n  gap: 4px;\n}\n\nbutton.panel-gradient-action {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n  height: 22px;\n  padding: 0 7px;\n  border: 0;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  color: var(--panel-text-muted);\n  font: inherit;\n  font-size: 10px;\n  cursor: pointer;\n}\n\nbutton.panel-gradient-action:not(:disabled):hover,\nbutton.panel-gradient-action:not(:disabled):focus-visible {\n  background: var(--panel-surface-active);\n  color: var(--panel-text);\n  outline: none;\n}\n\nbutton.panel-gradient-action:disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n.panel-gradient-graph {\n  position: relative;\n  width: 100%;\n  height: 120px;\n  box-sizing: border-box;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  touch-action: none;\n  user-select: none;\n  overflow: visible;\n}\n\n.panel-gradient-graph.is-ramp {\n  height: 56px;\n  padding: 8px 8px 0;\n}\n\n.panel-gradient-graph.is-editable {\n  cursor: crosshair;\n}\n\n.panel-gradient-track {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  touch-action: none;\n}\n\n.panel-gradient-fill {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 0;\n  height: 30px;\n  border-radius: 4px;\n  pointer-events: none;\n  box-shadow: inset 0 0 0 1px var(--panel-swatch-border);\n}\n\n.panel-gradient-baseline {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 10px;\n  height: 1px;\n  background: var(--panel-hash);\n  pointer-events: none;\n}\n\n.panel-gradient-field {\n  position: absolute;\n  left: calc(12 / 168 * 100%);\n  top: calc(12 / 120 * 100%);\n  width: calc(144 / 168 * 100%);\n  height: calc(96 / 120 * 100%);\n  border-radius: 2px;\n  pointer-events: none;\n  image-rendering: auto;\n}\n\n.panel-gradient-plane {\n  position: absolute;\n  inset: 0;\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n  pointer-events: none;\n}\n\n.panel-gradient-graph line {\n  stroke: var(--panel-hash);\n  stroke-width: 1;\n  vector-effect: non-scaling-stroke;\n}\n\n.panel-gradient-handles {\n  position: absolute;\n  left: calc(12 / 168 * 100%);\n  top: calc(12 / 120 * 100%);\n  width: calc(144 / 168 * 100%);\n  height: calc(96 / 120 * 100%);\n  pointer-events: none;\n}\n\n.panel-gradient-handle {\n  position: absolute;\n  width: 16px;\n  height: 16px;\n  box-sizing: border-box;\n  border-radius: 999px;\n  border: 2px solid #fff;\n  box-shadow: 0 1px 2px rgb(0 0 0 / 45%);\n  transform: translate(-50%, -50%);\n  cursor: grab;\n}\n\n.panel-gradient-handle.is-selected {\n  width: 20px;\n  height: 20px;\n  border-width: 4px;\n  border-color: #fff;\n}\n\n.panel-gradient-handle.is-ramp {\n  top: auto;\n  bottom: 4px;\n  width: 12px;\n  height: 12px;\n  transform: translate(-50%, 0);\n}\n\n.panel-gradient-handle.is-ramp.is-selected {\n  width: 14px;\n  height: 14px;\n  border-width: 3px;\n}\n\n.panel-gradient-selected {\n  display: grid;\n  grid-template-columns: 24px minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.panel-gradient-selected-meta {\n  display: grid;\n  min-width: 0;\n}\n\n.panel-gradient-selected-name,\n.panel-gradient-selected-code {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.panel-gradient-selected-name {\n  color: var(--panel-text);\n}\n\n.panel-gradient-selected-code,\n.panel-gradient-selected-offset {\n  color: var(--panel-text-muted);\n  font-variant-numeric: tabular-nums;\n}\n\n.panel-gradient-swatch-wrap {\n  display: inline-flex;\n  position: relative;\n}\n\n.panel-gradient-swatch-native {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  opacity: 0;\n  pointer-events: none;\n}\n\nbutton.panel-gradient-swatch {\n  box-sizing: border-box;\n  width: 24px;\n  height: 24px;\n  min-width: 24px;\n  min-height: 24px;\n  padding: 0;\n  border: 1px solid var(--panel-swatch-border);\n  border-radius: 4px;\n  box-shadow: none;\n  cursor: pointer;\n  background-color: var(--panel-gradient-swatch-color, #000000);\n  background-image: var(--panel-gradient-swatch-image, none);\n  background-position:\n    0 0,\n    0 6px,\n    6px -6px,\n    -6px 0;\n  background-size: 12px 12px;\n}\n\n.panel-gradient-library {\n  display: grid;\n  grid-template-columns: 24px minmax(0, 1fr);\n  gap: 8px;\n  align-items: center;\n  width: 100%;\n  min-width: 0;\n  height: 24px;\n  font-size: 11px;\n}\n\n.panel-gradient-library.has-clear {\n  grid-template-columns: 24px minmax(0, 1fr) 22px;\n}\n\n.panel-gradient-library-value {\n  display: block;\n  min-width: 0;\n  width: 100%;\n  height: 24px;\n  border: 0;\n  border-radius: 4px;\n  background-color: var(--panel-surface);\n  color: var(--panel-text);\n  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace;\n  font-size: 10px;\n  line-height: 24px;\n  padding: 0 8px;\n  outline: none;\n  box-sizing: border-box;\n  text-transform: uppercase;\n}\n\n.panel-gradient-library-value.is-token {\n  text-transform: none;\n  font-family: inherit;\n  letter-spacing: 0.01em;\n}\n\n.panel-gradient-library-value::placeholder {\n  color: var(--panel-muted-icon);\n  text-transform: none;\n}\n\n.panel-gradient-library-value:focus {\n  box-shadow: inset 0 0 0 1px var(--panel-text-muted);\n}\n\n.panel-gradient-library-clear {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 22px;\n  height: 22px;\n  padding: 0;\n  border: 1px solid transparent;\n  border-radius: 4px;\n  background-color: transparent;\n  color: var(--panel-text-muted);\n  font-size: 15px;\n  line-height: 1;\n  cursor: pointer;\n}\n\n.panel-gradient-library-clear:hover:not(:disabled) {\n  background-color: var(--panel-surface-active);\n  color: var(--panel-text);\n}\n";

/**
 * Named easing curves + `custom:x1,y1,x2,y2` cubic-bezier easings, shared by
 * the stripe colors table's easing selects/graphs and any consumer that wants
 * to evaluate the same curve at runtime.
 */
declare const EASING_OPTIONS: {
    readonly Linear: "linear";
    readonly Ease: "ease";
    readonly "Ease-in": "easeIn";
    readonly "Ease-out": "easeOut";
    readonly "Ease-in-out": "easeInOut";
    readonly "Ease In Sine": "easeInSine";
    readonly "Ease Out Sine": "easeOutSine";
    readonly "Ease In Out Sine": "easeInOutSine";
    readonly "Ease In Quad": "easeInQuad";
    readonly "Ease Out Quad": "easeOutQuad";
    readonly "Ease In Out Quad": "easeInOutQuad";
    readonly "Ease In Cubic": "easeInCubic";
    readonly "Ease Out Cubic": "easeOutCubic";
    readonly "Ease In Out Cubic": "easeInOutCubic";
    readonly "Ease In Quart": "easeInQuart";
    readonly "Ease Out Quart": "easeOutQuart";
    readonly "Ease In Out Quart": "easeInOutQuart";
    readonly "Ease In Quint": "easeInQuint";
    readonly "Ease Out Quint": "easeOutQuint";
    readonly "Ease In Out Quint": "easeInOutQuint";
    readonly "Ease In Expo": "easeInExpo";
    readonly "Ease Out Expo": "easeOutExpo";
    readonly "Ease In Out Expo": "easeInOutExpo";
    readonly "Ease In Circ": "easeInCirc";
    readonly "Ease Out Circ": "easeOutCirc";
    readonly "Ease In Out Circ": "easeInOutCirc";
    readonly "Ease In Back": "easeInBack";
    readonly "Ease Out Back": "easeOutBack";
    readonly "Ease In Out Back": "easeInOutBack";
    readonly "Ease In Elastic": "easeInElastic";
    readonly "Ease Out Elastic": "easeOutElastic";
    readonly "Ease In Out Elastic": "easeInOutElastic";
    readonly "Ease In Bounce": "easeInBounce";
    readonly "Ease Out Bounce": "easeOutBounce";
    readonly "Ease In Out Bounce": "easeInOutBounce";
};
type PresetEasingName = (typeof EASING_OPTIONS)[keyof typeof EASING_OPTIONS];
type EasingName = PresetEasingName | `custom:${number},${number},${number},${number}`;
type CustomEasingControlPoints = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
declare const DEFAULT_CUSTOM_EASING: CustomEasingControlPoints;
declare function formatCustomEasing({ x1, y1, x2, y2, }: CustomEasingControlPoints): EasingName;
declare function parseCustomEasing(value: string | undefined): CustomEasingControlPoints | null;
declare function easeValue(t: number, easing: string | undefined): number;

/**
 * Row shape for the stripe colors table, plus adapters to/from the numeric
 * `color` shape stripe engines use (structural match for
 * `@necatikcl/stripes-engine`'s `Stripe` — no dependency taken).
 */
type EngineStripe = {
    color: number;
    startFrom: number;
    width: number;
    opacity: number;
};
type EditableStripe = {
    id: string;
    hex: string;
    startFrom: number;
    width: number;
    opacity: number;
};
declare function toEditable(stripes: EngineStripe[]): EditableStripe[];
declare function fromEditable(rows: EditableStripe[]): EngineStripe[];

interface EasingGraphProps {
    value: string | undefined;
    disabled?: boolean;
    editableDefault?: CustomEasingControlPoints;
    onChange?: (value: string) => void;
}
/** Editable cubic-bezier preview — drag the two handles to author `custom:` easings. */
declare function EasingGraph({ value, disabled, editableDefault, onChange, }: EasingGraphProps): react.JSX.Element;
interface ControlStripeColorsTableProps {
    value: readonly EditableStripe[];
    onChange: (next: EditableStripe[]) => void;
    disabled?: boolean;
    /** Named color library for token display + wide-gamut swatches. */
    library?: ColorLibrary;
    showRampEasing?: boolean;
    rampEasingOptions?: Readonly<Record<string, string>>;
    rampEasingValue?: string;
    onRampEasingChange?: (easing: string) => void;
    thresholdEasingOptions?: Readonly<Record<string, string>>;
    thresholdEasingValue?: string;
    onThresholdEasingChange?: (easing: string) => void;
    /** Hide the color swatches (image-driven levels). Default `true`. */
    showColorControls?: boolean;
    showSavePalette?: boolean;
    onSavePalette?: () => void;
    onShufflePalette?: () => void;
    onUndoShuffle?: () => void;
    canUndoShuffle?: boolean;
    /** Injectable color popover; falls back to the native picker swatch. */
    renderColorPopover?: PanelColorPopoverRenderer;
    className?: string;
}
/**
 * Stripe rows editor: per-stripe color swatch (popover trigger), opacity /
 * threshold / width sliders, drag-to-reorder, add/remove, flip color order,
 * and optional easing controls. Fully controlled — `value` + `onChange`.
 */
declare function ControlStripeColorsTable({ value, onChange, disabled, library, showRampEasing, rampEasingOptions, rampEasingValue, onRampEasingChange, thresholdEasingOptions, thresholdEasingValue, onThresholdEasingChange, showColorControls, showSavePalette, onSavePalette, onShufflePalette, onUndoShuffle, canUndoShuffle, renderColorPopover, className, }: ControlStripeColorsTableProps): react.JSX.Element;
/**
 * CSS for the stripe colors table. Injected by the package's style pipeline;
 * exported so custom setups can inject it manually.
 */
declare const stripeColorsTableStyles = "\n.panel-stripes-table {\n  display: grid;\n  width: 100%;\n  min-width: 0;\n  row-gap: 0;\n  font-size: 11px;\n  color: var(--panel-text);\n}\n\n.panel-stripes-table.is-disabled {\n  pointer-events: none;\n  opacity: 0.45;\n}\n\n.panel-stripes-palette-wrap {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  margin-bottom: 10px;\n}\n\n.panel-stripes-palette-title {\n  color: var(--panel-text-muted);\n  font-weight: 400;\n  line-height: 1.2;\n}\n\n.panel-stripes-palette-toolbar {\n  display: grid;\n  grid-template-columns: repeat(3, auto);\n  justify-content: end;\n  gap: 6px;\n  min-width: 0;\n}\n\nbutton.panel-stripes-palette-action {\n  min-width: 44px;\n  height: 24px;\n  padding: 0 8px;\n  border: 1px solid transparent;\n  border-radius: 4px;\n  background-color: var(--panel-surface);\n  color: var(--panel-text-muted);\n  font: inherit;\n  font-size: 11px;\n  white-space: nowrap;\n  cursor: pointer;\n}\n\nbutton.panel-stripes-palette-action:not(:disabled):hover,\nbutton.panel-stripes-palette-action:not(:disabled):focus-visible {\n  background-color: var(--panel-surface-active);\n  color: var(--panel-text);\n  outline: none;\n}\n\nbutton.panel-stripes-palette-action:disabled {\n  cursor: not-allowed;\n  opacity: 0.45;\n}\n\n.panel-stripes-easing-row {\n  display: grid;\n  grid-template-columns: 76px minmax(0, 1fr);\n  align-items: start;\n  gap: 6px;\n  min-width: 0;\n}\n\n.panel-stripes-easing-control {\n  display: grid;\n  gap: 5px;\n  min-width: 0;\n}\n\n.panel-stripes-easing-graph {\n  width: 100%;\n  height: 88px;\n  display: block;\n  overflow: visible;\n  border-radius: 4px;\n  background: var(--panel-surface);\n  touch-action: none;\n  user-select: none;\n}\n\n.panel-stripes-easing-graph.is-editable {\n  cursor: crosshair;\n}\n\n.panel-stripes-easing-graph line {\n  stroke: var(--panel-hash);\n  stroke-width: 1;\n  vector-effect: non-scaling-stroke;\n}\n\n.panel-stripes-easing-graph polyline {\n  fill: none;\n  stroke: var(--panel-text-muted);\n  stroke-width: 1.5;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  vector-effect: non-scaling-stroke;\n}\n\n.panel-stripes-easing-handle-line {\n  stroke: var(--panel-hash);\n  stroke-width: 1;\n  stroke-dasharray: 2 2;\n  vector-effect: non-scaling-stroke;\n}\n\n.panel-stripes-easing-handle {\n  fill: var(--panel-text-muted);\n  stroke: var(--panel-surface);\n  stroke-width: 1;\n  vector-effect: non-scaling-stroke;\n}\n\n.panel-stripes-drawer-toggle {\n  display: grid;\n  grid-template-columns: 14px minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 6px;\n  width: 100%;\n  min-width: 0;\n  height: 28px;\n  margin-top: 8px;\n  padding: 0 8px;\n  border: 1px solid transparent;\n  border-radius: 4px;\n  background-color: var(--panel-surface);\n  color: var(--panel-text-muted);\n  font: inherit;\n  font-size: 11px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.panel-stripes-drawer-toggle:not(:disabled):hover,\n.panel-stripes-drawer-toggle:not(:disabled):focus-visible {\n  background-color: var(--panel-surface-active);\n  color: var(--panel-text);\n  outline: none;\n}\n\n.panel-stripes-drawer-toggle span:nth-child(2) {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.panel-stripes-drawer-count {\n  color: var(--panel-text-muted);\n  font-variant-numeric: tabular-nums;\n}\n\n.panel-stripes-drawer-panel {\n  display: grid;\n  row-gap: 8px;\n  min-width: 0;\n  padding-top: 8px;\n}\n\n.panel-stripes-detail-list {\n  display: grid;\n  row-gap: 8px;\n  min-width: 0;\n}\n\n.panel-stripes-detail-row {\n  display: grid;\n  gap: 6px;\n  min-width: 0;\n  padding: 6px 0;\n  border-bottom: 1px solid var(--panel-divider);\n}\n\n.panel-stripes-detail-row:last-child {\n  border-bottom: none;\n}\n\n.panel-stripes-detail-row[data-panel-dragging=\"true\"] {\n  opacity: 0.5;\n}\n\n.panel-stripes-detail-row[data-panel-dragover=\"true\"] {\n  box-shadow: 0 -1px 0 0 var(--panel-text-muted);\n}\n\n.panel-stripes-color-header {\n  display: grid;\n  grid-template-columns: 18px 24px minmax(0, 1fr) 16px;\n  align-items: center;\n  column-gap: 8px;\n  min-width: 0;\n}\n\n.panel-stripes-grip {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  padding: 0;\n  color: var(--panel-muted-icon);\n  touch-action: none;\n  cursor: grab;\n}\n\n.panel-stripes-grip:active {\n  cursor: grabbing;\n}\n\n.panel-stripes-detail-row:hover .panel-stripes-grip,\n.panel-stripes-grip:focus-visible {\n  color: var(--panel-text);\n  outline: none;\n}\n\nbutton.panel-stripes-swatch {\n  box-sizing: border-box;\n  width: 24px;\n  height: 24px;\n  min-width: 24px;\n  min-height: 24px;\n  padding: 0;\n  border: 1px solid var(--panel-swatch-border);\n  border-radius: 4px;\n  box-shadow: none;\n  cursor: pointer;\n  background-color: var(--panel-stripes-swatch-color, #000000);\n}\n\n.panel-stripes-swatch-placeholder {\n  width: 24px;\n  height: 24px;\n}\n\n.panel-stripes-color-meta {\n  display: flex;\n  align-items: baseline;\n  gap: 6px;\n  min-width: 0;\n}\n\n.panel-stripes-color-name,\n.panel-stripes-color-code {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n  font-variant-numeric: tabular-nums;\n}\n\n.panel-stripes-color-name {\n  color: var(--panel-text);\n}\n\n.panel-stripes-color-code {\n  flex: 0 1 auto;\n  color: var(--panel-text-muted);\n  font-size: 10px;\n}\n\nbutton.panel-stripes-remove {\n  justify-self: end;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 16px;\n  height: 16px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: var(--panel-muted-icon);\n  cursor: pointer;\n}\n\nbutton.panel-stripes-remove:not(:disabled):hover {\n  color: var(--panel-danger);\n}\n\n.panel-stripes-control-stack {\n  display: grid;\n  row-gap: 6px;\n  min-width: 0;\n  padding-left: 26px;\n}\n\n.panel-stripes-label {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  min-width: 0;\n  font-weight: 400;\n  color: var(--panel-text-muted);\n}\n\nbutton.panel-stripes-add {\n  margin-top: 8px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 4px;\n  width: 100%;\n  height: 24px;\n  border: 1px dashed var(--panel-swatch-border);\n  border-radius: 4px;\n  background-color: transparent;\n  color: var(--panel-text-muted);\n  font: inherit;\n  font-size: 11px;\n  cursor: pointer;\n}\n\nbutton.panel-stripes-add:not(:disabled):hover {\n  border-color: var(--panel-text-muted);\n  color: var(--panel-text);\n}\n\nbutton.panel-stripes-save {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 100%;\n  height: 28px;\n  border: 1px solid var(--panel-swatch-border);\n  border-radius: 4px;\n  background-color: var(--panel-surface);\n  color: var(--panel-text);\n  font: inherit;\n  font-size: 11px;\n  cursor: pointer;\n}\n\nbutton.panel-stripes-save:not(:disabled):hover,\nbutton.panel-stripes-save:not(:disabled):focus-visible {\n  border-color: var(--panel-text-muted);\n  background-color: var(--panel-surface-active);\n  outline: none;\n}\n";

export { type AnyRenderableField, ColorLibrary, type ColorLibraryColor, type ColorLibraryGroup, ColorPopover, type ColorPopoverProps, ControlAction, ControlActionGroup, type ControlActionGroupProps, type ControlActionProps, ControlAnimation, type ControlAnimationProps, ControlCollection, type ControlCollectionProps, ControlColorInput, type ControlColorInputProps, ControlDisclosure, type ControlDisclosureProps, ControlGradientStops, type ControlGradientStopsLayout, type ControlGradientStopsProps, ControlHint, type ControlHintProps, ControlImageInput, type ControlImageInputProps, ControlLibraryColor, type ControlLibraryColorProps, ControlOptionList, type ControlOptionListItem, type ControlOptionListProps, ControlPath, type ControlPathProps, type ControlPresetOption, ControlPresets, type ControlPresetsProps, ControlReadout, type ControlReadoutProps, ControlReference, type ControlReferenceProps, ControlSearchField, type ControlSearchFieldProps, ControlSection, type ControlSectionProps, ControlSelect, type ControlSelectProps, ControlSlider, type ControlSliderProps, ControlStripeColorsTable, type ControlStripeColorsTableProps, ControlTextInput, type ControlTextInputProps, ControlTextarea, type ControlTextareaProps, ControlThemeToggle, type ControlThemeToggleProps, ControlToggle, ControlToggleGroup, type ControlToggleGroupOption, type ControlToggleGroupProps, type ControlToggleProps, ControlVec2, type ControlVec2Props, type CustomEasingControlPoints, DEFAULT_CUSTOM_EASING, EASING_OPTIONS, EasingGraph, type EasingGraphProps, type EasingName, type EditableStripe, type EngineStripe, EyeToggle, type EyeToggleProps, FloatingPanel, GRADIENT_STOP_MAX, GRADIENT_STOP_MIN, type GradientStop, NativeColorSwatch, OverlayProjector, OverlayProjectorOptions, PANEL_ANIMATION_STEP, PANEL_CSS, PANEL_STYLE_ID, PANEL_TOGGLE_EVENT, Panel, type PanelAnimationSnapshot, PanelCollectionField, PanelCollectionItem, type PanelColorPopoverProps, type PanelColorPopoverRenderer, PanelField, PanelPrompt, PanelReferenceField, PanelRoot, PanelSelectOption, PanelSide, PanelTheme, PanelToggleButton, type PanelToggleButtonProps, PanelToolPanel, type PathPoint, type PresetEasingName, type RenderFieldContext, type RenderedField, RendererBinding, type ShaderCaptureFn, type ShaderGifExportFn, type ShaderGifExportOptions, type ShaderRecordFrameFn, type ShaderRecordingOptions, type ShaderVideoExportFn, type ShaderVideoSession, TOOL_PANEL_FULL, TOOL_PANEL_INSET, TOOL_PANEL_WIDTH, ToolPanel, type ToolPanelProps, ToolShell, type ToolShellProps, addGradientStop, advancePanelAnimationDelta, clearPersistedPanelSections, clearPersistedPanelValues, colorPopoverStyles, createOverlayProjector, defaultGradientStops, dispatchPanelToggle, easeValue, embedPngDpi, formatCustomEasing, fromEditable, getPanelAnimationRevision, getPanelAnimationSnapshot, getPanelAnimationTime, getShaderCapture, getShaderGifExport, getShaderRecordCanvas, getShaderRecordFrame, getShaderRecordPrepare, getShaderVideoExport, gradientCss, gradientStopsStyles, handlePanelShortcutKeydown, hasPersistedPanelValues, initPanelAnimationClock, installPanelKeyboard, loadPersistedPanelSections, loadPersistedPanelValues, matchPanelShortcut, moveGradientStop, moveGradientStopOffset, normalizeGradientStops, parseCustomEasing, pausePanelAnimation, persistPanelSections, persistPanelValues, playPanelAnimation, printMaxEdgePx, rasterizeGradientField, readPanelOpenFlag, recolorGradientStop, registerShaderCapture, registerShaderGifExport, registerShaderRecordCanvas, registerShaderRecordFrame, registerShaderRecordPrepare, registerShaderVideoExport, removeGradientStop, renderPanelField, resetPanelAnimation, sampleGradientRgb, serializeGradientStops, setPanelAnimationRate, setPanelAnimationTime, setShaderRecording, sortGradientStops, stepPanelAnimationBackward, stepPanelAnimationForward, stripeColorsTableStyles, subscribePanelAnimation, subscribeShaderCapture, subscribeShaderRecording, toEditable, togglePanelAnimation, usePanelShortcut, writePanelOpenFlag };
