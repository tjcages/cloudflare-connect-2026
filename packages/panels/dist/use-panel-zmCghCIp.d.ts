import * as react from 'react';

type PanelPrompt = {
    id: string;
    title: string;
    /** Short one-liner shown beneath the title in the preview. */
    description?: string;
    /**
     * The full prompt text. Copy-pasteable as-is — no manual editing required.
     * The `{{shader}}` token is replaced with the active shader's name at
     * copy/preview time; files are referenced via project context so the
     * receiving editor (Cursor / Claude Code / Copilot) resolves them itself.
     */
    prompt: string;
};
/**
 * Replace `{{shader}}` (and whitespace variants) with the active shader's
 * name. Falls back to a generic "shader" when no name is available.
 */
declare function fillPanelPrompt(prompt: string, shaderName?: string): string;
/**
 * Built-in AI prompts surfaced in the panel's "Quick actions" rail.
 * Each prompt is a copy-pasteable instruction for Claude / Cursor / Codex —
 * written as a senior-graphics-engineer brief, not a one-liner. They reference
 * files by project context (no paths to fill in) and name the active shader
 * automatically via the `{{shader}}` token.
 *
 * Override per-shader by passing `prompts` to `registerPanel`.
 */
declare const DEFAULT_PANEL_PROMPTS: ReadonlyArray<PanelPrompt>;

/**
 * Renderer-agnostic overlay types (OFF-138).
 *
 * The core knows nothing about Three.js / R3F / WebGL. A renderer adapter
 * supplies the two primitives everything else is built on via `RendererBinding`
 * — `project` (world → screen px) and `onFrame` (per-frame tick driven by the
 * panel clock). The R3F binding ships in `@tjcages/panels/shader`; a raw 2D
 * canvas can supply a trivial identity binding.
 */
/** A 3-component world/scene position. Plain tuple — no Three.js dependency. */
type Vec3 = readonly [number, number, number];
/** Result of projecting a world position to the screen. */
type ProjectedPoint = {
    /** Screen px, relative to the canvas top-left. */
    x: number;
    /** Screen px, relative to the canvas top-left. */
    y: number;
    /** `false` when behind the camera or otherwise culled. */
    visible: boolean;
};
/**
 * The renderer adapter. Supplies world→screen projection and a per-frame hook;
 * `createOverlayProjector` needs nothing else.
 */
type RendererBinding = {
    /**
     * World/scene position → screen px (relative to the canvas), or `null` if
     * culled (behind camera / off-screen).
     */
    project: (world: Vec3) => ProjectedPoint | null;
    /**
     * Screen px → world position on a target surface (raycast); `null` on a miss.
     * Optional — only needed by the drag helpers (OFF-139).
     */
    unproject?: (screen: {
        x: number;
        y: number;
    }) => Vec3 | null;
    /**
     * Register a per-frame callback driven by the panel clock (OFF-140). Returns
     * an unsubscribe fn.
     */
    onFrame: (cb: (t: {
        time: number;
        delta: number;
    }) => void) => () => void;
};
/** A scene anchor: a DOM node kept pinned over a world position every frame. */
type OverlayAnchor = {
    /** Stable id (used only for bookkeeping / debugging). */
    id: string;
    /** World position to project. Called every frame — return a fresh value. */
    getWorld: () => Vec3;
    /** The DOM node to position. Written to with `transform` / `visibility` only. */
    node: HTMLElement;
    /** When `false`, the node is hidden regardless of projection. Default `true`. */
    visible?: boolean;
};
/** Handle returned by `createOverlayProjector`. */
type OverlayProjector = {
    /**
     * Register an anchor. Appends its node to the overlay layer and starts
     * positioning it each frame. Returns an unregister fn that removes the node.
     */
    register: (anchor: OverlayAnchor) => () => void;
    /** Tear down: stop the frame loop and remove the overlay layer from the DOM. */
    destroy: () => void;
};
/** Options for `createOverlayProjector`. */
type OverlayProjectorOptions = {
    /**
     * The element the overlay layer is appended to. The layer is absolutely
     * positioned to fill it, so this should be the canvas's positioned parent.
     * Defaults to `document.body` (only sensible for a full-viewport canvas).
     */
    container?: HTMLElement;
};

type PanelTheme = "light" | "dark";
declare const PANEL_THEME_STORAGE_KEY = "shader-dev-theme";
declare global {
    interface Window {
        __themeOverride?: string;
    }
}
/** Apply light/dark to the document root and persist the user's choice. */
declare function applyPanelTheme(mode: PanelTheme, storageKey?: string): void;
/**
 * Resolution priority (highest wins):
 *   1. `html.dark` class on document root
 *   2. `defaultTheme` argument (per-mount opinion — pass this from the page)
 *   3. OS `prefers-color-scheme`
 */
declare function usePanelTheme(defaultTheme?: PanelTheme): PanelTheme;
declare const PanelThemeProvider: react.Provider<PanelTheme>;
declare function usePanelThemeContext(): PanelTheme;

type PanelSide = "left" | "right";
type PanelSectionField = {
    type: "section";
    title: string;
};
type PanelSliderField<T extends Record<string, unknown>> = {
    type: "slider";
    key: keyof T & string;
    label: string;
    min: number;
    max: number;
    step: number;
    /** Optional one-line hint rendered as small muted text above the slider.
     *  Use sparingly — only when behaviour can't be conveyed in the label. */
    description?: string;
};
type PanelColorField<T extends Record<string, unknown>> = {
    type: "color";
    key: keyof T & string;
    label: string;
    /** Optional one-line hint rendered as small muted text above the color field. */
    description?: string;
};
type PanelToggleField<T extends Record<string, unknown>> = {
    type: "toggle";
    key: keyof T & string;
    label: string;
    /** Optional one-line hint rendered as small muted text above the toggle. */
    description?: string;
};
type PanelSelectOption = {
    value: string | number;
    label: string;
};
type PanelSelectField<T extends Record<string, unknown>> = {
    type: "select";
    key: keyof T & string;
    label: string;
    options: ReadonlyArray<PanelSelectOption>;
    /** Label above control (default) or on the same row. */
    layout?: "inline" | "stacked";
    description?: string;
};
type PanelToggleGroupOption = {
    value: string | number;
    /** Text label. Omit when using an icon-only option. */
    label?: string;
};
/**
 * Segmented single-select control — N option buttons sharing one track, the
 * selected value highlighted. Options render as text (via `label`); icon
 * options are only available when constructing `ControlToggleGroup` directly.
 */
type PanelToggleGroupField<T extends Record<string, unknown>> = {
    type: "toggle-group";
    key: keyof T & string;
    label: string;
    options: ReadonlyArray<PanelToggleGroupOption>;
    description?: string;
};
/**
 * Pair of coupled sliders that read/write a `[x, y]` tuple at `key`.
 * Use for direction vectors, scroll offsets, anchor positions, etc.
 */
type PanelVec2Field<T extends Record<string, unknown>> = {
    type: "vec2";
    key: keyof T & string;
    label: string;
    min: number;
    max: number;
    step: number;
    /** Optional per-axis labels. Default to "X" / "Y". */
    xLabel?: string;
    yLabel?: string;
};
/**
 * Image slot backed by a string URL (asset path, blob/object URL, or data URL).
 *
 * Renders a thumbnail preview; unless `readonly`, clicking (or dropping a file
 * onto) the preview picks a local file and writes an object URL to the config.
 *
 * Image values are NEVER persisted to localStorage — object URLs don't survive
 * a reload, so on refresh the field falls back to its default.
 */
type PanelImageField<T extends Record<string, unknown>> = {
    type: "image";
    key: keyof T & string;
    label: string;
    /** Preview-only slot for generated outputs (e.g. a depth map) — no upload UI. */
    readonly?: boolean;
    /** `accept` attribute for the file picker. Default `"image/*"`. */
    accept?: string;
    /** Muted text shown when the value is an empty string. */
    emptyLabel?: string;
    description?: string;
};
/**
 * 2D waypoint path editor. The value is an ordered array of `[x, y]` points a
 * light (or anything) travels through. Click the pad to append a point, drag a
 * point to move it, double-click to remove it.
 *
 * `anchorKey` optionally names another config key holding the `[x, y]` home
 * position, drawn as the start of the path (waypoints chain off it). When set,
 * the home point is draggable on the path pad and writes back to that key.
 */
type PanelPathField<T extends Record<string, unknown>> = {
    type: "path";
    key: keyof T & string;
    label: string;
    min: number;
    max: number;
    anchorKey?: keyof T & string;
    description?: string;
};
/**
 * One-off action button — does not read or write config. Wire handlers via
 * `actionHandlers` on `usePanel` / `Panel`.
 */
type PanelActionField = {
    type: "action";
    /** Key into the `actionHandlers` map passed to the panel. */
    actionId: string;
    label: string;
    description?: string;
    variant?: "default" | "primary";
    /** Optional predicate — hide the button when this returns false. */
    when?: (values: Record<string, unknown>) => boolean;
};
/**
 * One-click preset that merges partial values or replaces the full config.
 * Use a function for presets that need the current state (e.g. reset-all).
 */
type PanelPresetOption<T extends Record<string, unknown>> = {
    label: string;
    /** Merge partial values or replace via function. Omit when using `actionId`. */
    values?: Partial<T> | ((current: T) => T);
    /** Call a handler from `actionHandlers` instead of merging values. */
    actionId?: string;
};
type PanelPresetsField<T extends Record<string, unknown>> = {
    type: "presets";
    /** Optional heading above the preset buttons. */
    label?: string;
    presets: ReadonlyArray<PanelPresetOption<T>>;
};
/** Minimum contract for a collection item — a stable string id. */
type PanelCollectionItem = {
    id: string;
};
/**
 * A managed list of items stored as an array at `key` (`T[key]` is `Item[]`).
 * Each item is edited through its own `itemFields`, rendered recursively via
 * the same field renderer every other control uses — so sliders, selects,
 * colors, references, etc. all work unchanged inside an item.
 *
 * Items MUST carry a stable `id: string`. On add, if `newItem()` omits it the
 * collection assigns one (`crypto.randomUUID()` with a counter fallback). `id`
 * is what React keys, reorder, selection, and references use.
 */
type PanelCollectionField<T extends Record<string, unknown>, Item extends PanelCollectionItem = PanelCollectionItem> = {
    type: "collection";
    /** `T[key]` must be `Item[]`. */
    key: keyof T & string;
    label: string;
    /**
     * Fields rendered for each item. A function receives the item + its index so
     * you can return per-item / per-type schemas (e.g. branch on `item.kind`).
     */
    itemFields: PanelField<Item>[] | ((item: Item, index: number) => PanelField<Item>[]);
    /** Row title. Default `${label} ${i + 1}`. */
    itemLabel?: (item: Item, index: number) => string;
    /** "Add" factory. Omit to hide the add button (list becomes read-only-size). */
    newItem?: () => Omit<Item, "id"> | Item;
    /** Add-button label. Default `Add ${singular(label)}`. */
    addLabel?: string;
    /** Block remove below this count. */
    min?: number;
    /** Block add above this count. */
    max?: number;
    /** Show a drag handle to reorder. Default `true`. */
    reorderable?: boolean;
    /** Allow several rows open at once. Default `false` (single-open selection). */
    multiOpen?: boolean;
    /**
     * Applied to `T[key]` on load (after persistence merge) for versioned
     * item-shape changes — e.g. renaming a field across a schema bump.
     */
    migrate?: (items: Item[]) => Item[];
    description?: string;
};
/**
 * Points at an item (or items) in a sibling collection. The value at `key` is
 * a string id, or `string[]` when `multiple`. Resolving the label needs the
 * sibling collection, so the renderer receives the ROOT state, not just the
 * item being edited.
 */
type PanelReferenceField<T extends Record<string, unknown>> = {
    type: "reference";
    /** Value is a string id, or `string[]` when `multiple`. */
    key: keyof T & string;
    label: string;
    /** The sibling collection key whose items are the choices. */
    collection: keyof T & string;
    /** Allow multiple targets. Default `false`. */
    multiple?: boolean;
    /** How each choice reads. Default `itemLabel` / the item's `id`. */
    optionLabel?: (item: PanelCollectionItem) => string;
    /** Shown when unset. */
    placeholder?: string;
    description?: string;
};
type PanelField<T extends Record<string, unknown>> = PanelSectionField | PanelSliderField<T> | PanelColorField<T> | PanelToggleField<T> | PanelSelectField<T> | PanelToggleGroupField<T> | PanelVec2Field<T> | PanelImageField<T> | PanelPathField<T> | PanelActionField | PanelPresetsField<T> | PanelCollectionField<T> | PanelReferenceField<T>;
type PanelWriteResult = {
    ok: boolean;
    message: string;
};
declare function isPanelSection(field: PanelField<Record<string, unknown>>): field is PanelSectionField;

type PanelState = Record<string, unknown>;
type PanelRegistration<T extends PanelState = PanelState> = {
    id: string;
    title: string;
    /** Which side of the viewport the panel docks to. Default `"right"`. */
    side?: PanelSide;
    values: T;
    defaults: T;
    fields: PanelField<T>[];
    onChange: (next: T) => void;
    onWriteConfig?: (values: T) => Promise<PanelWriteResult>;
    writeLabel?: string;
    /**
     * Override the default AI-prompt rail at the top of the panel. Pass `[]`
     * to hide it entirely. Omit to use the built-in `DEFAULT_PANEL_PROMPTS`.
     */
    prompts?: ReadonlyArray<PanelPrompt>;
    /**
     * Persist uniform values to `localStorage["shader-dev:<id>"]`. Defaults to
     * `true`. Section expand/collapse is always persisted when `id` is set,
     * even if `persist: false` (so hosts can use their own value storage).
     */
    persist?: boolean;
    /** Handlers for `type: "action"` fields, keyed by `actionId`. */
    actionHandlers?: Record<string, () => void>;
};
/**
 * Register (or replace) a shader with the dev panel.
 *
 * Returns an unregister function — store it as the effect cleanup:
 * ```tsx
 * useEffect(() => registerPanel({...}), [config])
 * ```
 *
 * Passing `null` is a legacy no-arg cleanup: it removes the most recently
 * registered shader. Prefer returning the cleanup function or calling
 * `unregisterPanel(id)` explicitly.
 */
declare function registerPanel<T extends PanelState>(next: PanelRegistration<T> | null): () => void;
/** Remove a registration by id. No-op if id isn't registered. */
declare function unregisterPanel(id: string): void;
/** Switch which registered shader the panel shows on the given side. */
declare function setActivePanel(id: string): void;
declare function getActivePanelId(): string | null;
declare function getActivePanelIdForSide(side: PanelSide): string | null;
declare function getActivePanel(): PanelRegistration | null;
declare function getActivePanelForSide(side: PanelSide): PanelRegistration | null;
/** Snapshot of the registration map. */
declare function getPanelRegistrations(): ReadonlyMap<string, PanelRegistration>;
declare function getPanelRegistrationsForSide(side: PanelSide): PanelRegistration[];
/**
 * Monotonically incrementing counter — useful as a `useSyncExternalStore`
 * snapshot when you want to subscribe to "anything changed", not a specific
 * registration.
 */
declare function getPanelRevision(): number;
/** @deprecated Use `getActivePanel` */
declare function getPanelRegistration(): PanelRegistration | null;
declare function subscribePanelRegistration(listener: () => void): () => void;

type UsePanelOptions<T extends PanelState> = Omit<PanelRegistration<T>, "values" | "onChange"> & {
    /**
     * Auto-inject the panel into <body> so you don't render <PanelRoot/>
     * yourself. Default `true`. Set `false` if you mount the root manually.
     */
    autoMount?: boolean;
    /** Initial theme passed to the auto-mounted panel. */
    defaultTheme?: PanelTheme;
    /**
     * Open the panel by default the first time it mounts this session. Once the
     * user toggles it, their choice sticks (persisted in sessionStorage). Only
     * honored when `autoMount` is true. Default `false`.
     */
    defaultOpen?: boolean;
};
/**
 * One-call shader dev panel. Owns the config state, registers with the panel,
 * and (by default) injects the panel UI for you — no `<PanelRoot/>`, no
 * separate files.
 *
 * ```tsx
 * const [config] = usePanel({
 *   id: "my-shader",
 *   title: "My shader",
 *   defaults: DEFAULTS,
 *   fields: FIELDS,
 * })
 * // feed `config` to your shader
 * ```
 *
 * Returns a `useState`-style tuple so you can also set values yourself (e.g.
 * from props). Edits persist to localStorage and rehydrate on reload unless
 * `persist: false`.
 */
declare function usePanel<T extends PanelState>(options: UsePanelOptions<T>): [T, (next: T) => void];

export { type PanelWriteResult as A, type ProjectedPoint as B, applyPanelTheme as C, getActivePanel as D, getActivePanelForSide as E, getActivePanelId as F, getActivePanelIdForSide as G, getPanelRegistration as H, getPanelRegistrations as I, getPanelRegistrationsForSide as J, getPanelRevision as K, isPanelSection as L, registerPanel as M, setActivePanel as N, type OverlayProjectorOptions as O, type PanelTheme as P, subscribePanelRegistration as Q, type RendererBinding as R, unregisterPanel as S, usePanel as T, type UsePanelOptions as U, type Vec3 as V, usePanelTheme as W, usePanelThemeContext as X, DEFAULT_PANEL_PROMPTS as Y, fillPanelPrompt as Z, type OverlayProjector as a, type PanelSide as b, type PanelField as c, type PanelPrompt as d, type PanelSelectOption as e, type PanelCollectionField as f, type PanelCollectionItem as g, type PanelReferenceField as h, type OverlayAnchor as i, PANEL_THEME_STORAGE_KEY as j, type PanelActionField as k, type PanelColorField as l, type PanelImageField as m, type PanelPathField as n, type PanelPresetOption as o, type PanelPresetsField as p, type PanelRegistration as q, type PanelSectionField as r, type PanelSelectField as s, type PanelSliderField as t, type PanelState as u, PanelThemeProvider as v, type PanelToggleField as w, type PanelToggleGroupField as x, type PanelToggleGroupOption as y, type PanelVec2Field as z };
