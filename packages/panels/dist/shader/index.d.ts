import { c as PanelField, x as PanelState, U as UsePanelOptions, V as Vec3, R as RendererBinding } from '../use-panel-CCHDkUi0.js';
export { a9 as DEFAULT_PANEL_PROMPTS, d as PanelPrompt, aa as fillPanelPrompt } from '../use-panel-CCHDkUi0.js';
import { ReactNode, PointerEvent, CSSProperties } from 'react';
import { Object3D, Plane, Camera, Raycaster, Vector2, Vector3 } from 'three';

/** Parse `#rgb` / `#rrggbb` to a normalized `[r, g, b]` tuple in `[0, 1]`. */
declare function hexToRgb01(hex: string): [number, number, number];
type FieldKey<T> = keyof T & string;
type Mapping<T> = Partial<Record<FieldKey<T>, string>>;
type CreateWebGLAdapterOptions<T extends Record<string, unknown>> = {
    /** Field definitions — the adapter walks these to build the uniform record. */
    fields: PanelField<T>[];
    /**
     * Per-key uniform name overrides. Keys not listed fall back to
     * `prefix + key` (e.g. `speed` → `u_speed`).
     */
    mapping?: Mapping<T>;
    /** Default prefix when no `mapping[key]` is provided. Default `"u_"`. */
    prefix?: string;
    /** Hex → vec3 normalization. `rgb01` (default) matches typical GLSL `vec3` color uniforms. */
    colorAs?: "rgb01" | "rgb255";
    /** Toggle (boolean) encoding. Most GLSL prefers `int` (0/1); set this for raw bool. */
    toggleAs?: "int" | "bool";
};
/**
 * Build a `(config) => uniforms` function from a field schema.
 *
 * Drop-in for raw WebGL or `@paper-design/shaders` `ShaderMount.setUniforms(...)`.
 * No need to hand-roll `configToShaderUniforms` for each shader.
 *
 * ```ts
 * const toUniforms = createWebGLAdapter<MyConfig>({ fields: FIELDS })
 * mount.setUniforms(toUniforms(config))
 * ```
 */
declare function createWebGLAdapter<T extends Record<string, unknown>>({ fields, mapping, prefix, colorAs, toggleAs, }: CreateWebGLAdapterOptions<T>): (config: T) => Record<string, unknown>;
type CreateR3FAdapterOptions<T extends Record<string, unknown>> = {
    /** Live Three.js uniforms record. The adapter mutates `[name].value` in place. */
    uniforms: Record<string, {
        value: unknown;
    }>;
    fields: PanelField<T>[];
    mapping?: Mapping<T>;
    prefix?: string;
};
/**
 * Build an `apply(config)` function that mutates Three.js uniform slots in place
 * — no recompile, no uniforms-object recreation per render.
 *
 * Color slots are detected by the presence of a `.set` method on `value`
 * (matches `THREE.Color` and `THREE.Vector*`). Otherwise the value is replaced
 * directly. Call from a `useEffect([config])`.
 *
 * ```ts
 * const apply = useMemo(() => createR3FAdapter<MyConfig>({
 *   uniforms,
 *   fields: FIELDS,
 * }), [uniforms])
 * useEffect(() => apply(config), [config, apply])
 * ```
 */
declare function createR3FAdapter<T extends Record<string, unknown>>({ uniforms, fields, mapping, prefix, }: CreateR3FAdapterOptions<T>): (config: T) => void;

/**
 * Replace the defaults block between `// @shader-config-start` and
 * `// @shader-config-end` markers in a shader config module.
 *
 * Pass the symbol name (e.g. `ACCENT_SHADER_DEFAULTS` or `WAVE_SHADER_DEFAULTS`)
 * so the same helper works across any shader's config file.
 */
declare function patchShaderConfigDefaults(source: string, exportName: string, serializedDefaults: string): string;

type UseShaderPanelOptions<T extends PanelState> = UsePanelOptions<T>;
/**
 * `usePanel` pre-wired with the built-in shader AI-prompt rail — the
 * batteries-included entry for shader / WebGL / Three.js / R3F tools.
 *
 * Identical to `usePanel` except the prompt rail defaults on. Pass your own
 * `prompts` to override, or `prompts: []` to hide it.
 *
 * ```tsx
 * import { useShaderPanel, createR3FAdapter } from "@tjcages/panels/shader"
 * const [config] = useShaderPanel({ id, title, defaults, fields })
 * ```
 */
declare function useShaderPanel<T extends PanelState>(options: UseShaderPanelOptions<T>): [T, (next: T) => void];

/**
 * A target surface for `unproject` (screen → world raycast). One of:
 *
 * - `THREE.Plane` — hit that exact plane.
 * - `THREE.Object3D` (mesh/group) — hit its geometry (recursive).
 * - `{ radius }` — hit a sphere of that radius centered at `center` (default
 *   origin). This is region-earth's globe case.
 * - `{ point, normal? }` — hit a plane through `point` (default origin) with
 *   the given `normal` (default: faces the camera, recomputed per raycast).
 * - omitted → a plane through the world origin facing the camera.
 */
type RaycastSurface = Plane | Object3D | {
    radius: number;
    center?: Vec3;
} | {
    point?: Vec3;
    normal?: Vec3;
};
/**
 * Raycast from screen px onto a target surface and return the first world-space
 * hit, or `null` on a miss. Shared by `createR3FBinding().unproject` and the
 * drag helpers.
 *
 * `screen` is px relative to the canvas top-left (matching `project`'s output).
 */
declare function raycastSurface(screen: {
    x: number;
    y: number;
}, camera: Camera, rect: {
    width: number;
    height: number;
}, surface: RaycastSurface | undefined, scratch: {
    raycaster: Raycaster;
    ndc: Vector2;
    hit: Vector3;
    plane: Plane;
    normal: Vector3;
}): Vec3 | null;
/**
 * Build a `RendererBinding` for an R3F scene. `project` reads the current
 * camera + canvas size on each call; `onFrame` registers via a passed-in
 * subscribe fn (in R3F this is driven by `useFrame` — see `PanelOverlay`).
 *
 * Exposed so consumers can reuse the core `createOverlayProjector` directly
 * with an R3F scene. `PanelOverlay` handles the common case for you.
 */
declare function createR3FBinding(opts: {
    camera: Camera;
    /** The canvas element (for its client rect). */
    canvas: HTMLCanvasElement;
    /**
     * Per-frame subscribe. Return an unsubscribe fn. Typically wired to an
     * external `useFrame` tick; the core only needs it to be called each frame.
     */
    onFrame: RendererBinding["onFrame"];
    /**
     * Default surface for `unproject` (screen → world raycast). Omit for a plane
     * through the world origin facing the camera. See {@link RaycastSurface}.
     */
    surface?: RaycastSurface;
}): RendererBinding;
type PanelOverlayProps = {
    /** A live scene object (tracks its world matrix) or a static world position. */
    anchor: Object3D | Vec3;
    /** Hide the overlay without unmounting. Default `true` (shown). */
    visible?: boolean;
    /** Overlay content — portaled into the layer over the canvas. */
    children?: ReactNode;
};
/**
 * Pin a DOM overlay to a scene anchor. Render INSIDE an R3F `<Canvas>`:
 *
 * ```tsx
 * <PanelOverlay anchor={objectRef.current} visible={poi.visible}>
 *   <Pin label={poi.name} />
 * </PanelOverlay>
 * ```
 */
declare function PanelOverlay({ anchor, visible, children, }: PanelOverlayProps): ReactNode;

type UseDragHandleOptions = {
    /**
     * The item's current world position. Unused by the drag math itself (the
     * pointer is raycast against `surface`), but kept in the API so consumers
     * pass the item's field and it reads as a bound handle. May inform the
     * default surface later; today it's advisory.
     */
    anchor?: Vec3;
    /** Called on each pointer move with the new world position on `surface`. */
    onDrag: (world: Vec3) => void;
    /** Called once when the drag begins (pointer down on the handle). */
    onDragStart?: (world: Vec3 | null) => void;
    /** Called once when the drag ends (pointer up / cancel). */
    onDragEnd?: (world: Vec3 | null) => void;
    /**
     * The surface the pointer is raycast against. See {@link RaycastSurface}.
     * Omit for a plane through the world origin facing the camera.
     */
    surface?: RaycastSurface;
};
type DragHandleProps = {
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
    onPointerCancel: (e: PointerEvent) => void;
    style: CSSProperties;
};
type UseDragHandleReturn = {
    /** Spread onto the handle element. Opts back into `pointer-events: auto`. */
    handleProps: DragHandleProps;
    /** `true` between pointer down and up/cancel. */
    isDragging: () => boolean;
};
/**
 * Make an overlay element a draggable world-space handle.
 *
 * ```tsx
 * const drag = useDragHandle({
 *   anchor: item.pos,
 *   onDrag: (p) => setItem({ ...item, pos: p }),
 *   surface: { radius: 1 }, // globe
 * })
 * return (
 *   <PanelOverlay anchor={item.pos}>
 *     <div {...drag.handleProps} className="my-handle" />
 *   </PanelOverlay>
 * )
 * ```
 */
declare function useDragHandle(options: UseDragHandleOptions): UseDragHandleReturn;

export { type CreateR3FAdapterOptions, type CreateWebGLAdapterOptions, type DragHandleProps, PanelOverlay, type PanelOverlayProps, type RaycastSurface, type UseDragHandleOptions, type UseDragHandleReturn, type UseShaderPanelOptions, createR3FAdapter, createR3FBinding, createWebGLAdapter, hexToRgb01, patchShaderConfigDefaults, raycastSurface, useDragHandle, useShaderPanel };
