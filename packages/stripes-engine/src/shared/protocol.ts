import type { EngineConfig } from "../config/types";
import type { CellGridReadback } from "../engine";
import type { FramesOverlay } from "../frames/framesPaint";
import type { SharedShaderSourceSpec } from "./shaderSourceRenderer";

export type InstanceId = string;

export type SharedSourceFrame = ImageBitmap | VideoFrame;

export type RegisterMessage = {
  type: "register";
  id: InstanceId;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  config?: Partial<EngineConfig>;
  seed?: number;
  /**
   * Render the instance's source texture from GLSL inside the worker instead
   * of streaming media from the host. The renderer only advances on ticks the
   * instance actually renders, so the engine's `maxFps` caps it too.
   */
  shaderSource?: SharedShaderSourceSpec;
};

export type TickMessage = {
  type: "tick";
};

export type ResizeMessage = {
  type: "resize";
  id: InstanceId;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
};

export type VisibilityMessage = {
  type: "visibility";
  id: InstanceId;
  visible: boolean;
};

export type SourceMessage = {
  type: "source";
  id: InstanceId;
  frame: SharedSourceFrame | null;
  isStream: boolean;
};

export type SetConfigMessage = {
  type: "setConfig";
  id: InstanceId;
  config: Partial<EngineConfig>;
};

/** Replace or retune a shader-driven instance's GLSL texture source. */
export type ShaderSourceMessage = {
  type: "shaderSource";
  id: InstanceId;
  spec: SharedShaderSourceSpec;
};

export type CursorMessage = {
  type: "cursor";
  id: InstanceId;
  x: number | null;
  y?: number;
};

export type ClickMessage = {
  type: "click";
  id: InstanceId;
  x: number;
  y?: number;
};

/** Whether the reveal animation's clock may advance for this instance. */
export type RevealGateMessage = {
  type: "revealGate";
  id: InstanceId;
  open: boolean;
};

export type RevealMessage = {
  type: "reveal";
  id: InstanceId;
};

export type UnregisterMessage = {
  type: "unregister";
  id: InstanceId;
};

export type TerminateMessage = {
  type: "terminate";
};

/**
 * Ask the worker for a snapshot of its authoritative per-instance state. Only
 * posted while a stats subscriber is attached, so the protocol stays silent —
 * and the worker does no extra work — when the debug readout is off.
 */
export type StatsRequestMessage = {
  type: "statsRequest";
};

/** One-shot export readback for a specific shared shader instance. */
export type CellGridRequestMessage = {
  type: "cellGridRequest";
  id: InstanceId;
  requestId: number;
};

export type MainToWorkerMessage =
  | RegisterMessage
  | TickMessage
  | ResizeMessage
  | VisibilityMessage
  | SourceMessage
  | SetConfigMessage
  | ShaderSourceMessage
  | CursorMessage
  | ClickMessage
  | RevealMessage
  | RevealGateMessage
  | UnregisterMessage
  | TerminateMessage
  | CellGridRequestMessage
  | StatsRequestMessage;

export type ReadyMessage = {
  type: "ready";
};

export type ErrorMessage = {
  type: "error";
  id?: InstanceId;
  message: string;
};

export type NeedsSourceMessage = {
  type: "needsSource";
  id: InstanceId;
};

/** Where one instance's output sits inside a {@link FrameMessage} bitmap. */
export type FrameSlot = {
  id: InstanceId;
  /** Top-left of the slot in bitmap coordinates — GL's origin is bottom-left. */
  sx: number;
  sy: number;
  width: number;
  height: number;
  /**
   * The `frames` overlay to paint over this slot once it is blitted. Absent
   * unless the instance has frames enabled and its reveal has settled. Text is
   * measured where it is drawn, so this carries geometry and labels only — the
   * worker cannot see the document's fonts.
   */
  frames?: FramesOverlay;
};

/**
 * Every instance that rendered on one tick, in a single bitmap. `frame` is the
 * whole shared backbuffer, which is grow-only and therefore at least as large
 * as the packed slots; each instance's output is a disjoint rectangle the host
 * crops out with a source rect on the blit it was going to do anyway.
 *
 * One message — and so one `transferToImageBitmap` — per tick rather than one
 * per instance: handing the drawing buffer over costs a fixed ~0.65 ms of
 * worker time no matter how large it is, so the transfer *count* is the cost.
 */
export type FrameMessage = {
  type: "frame";
  frame: ImageBitmap;
  slots: FrameSlot[];
};

export type TockMessage = {
  type: "tock";
};

export type WaterActivityMessage = {
  type: "waterActivity";
  id: InstanceId;
  activity: number;
};

/**
 * Result of the last shader-source apply: the compile/link error, or null when
 * it took. On error the previous renderer keeps running.
 */
export type ShaderSourceErrorMessage = {
  type: "shaderSourceError";
  id: InstanceId;
  error: string | null;
};

/** The worker's authoritative view of one instance, for the debug readout. */
export type InstanceStatsSample = {
  id: InstanceId;
  /** Render gate: the worker only renders instances it believes are visible. */
  visible: boolean;
  hasSource: boolean;
  /** Post-normalization frame cap; `0` means uncapped. */
  maxFps: number;
  outputWidth: number;
  outputHeight: number;
  /** Internal field-chain resolution the engine is really rendering at. */
  fieldWidth: number;
  fieldHeight: number;
  /** The `fieldScale` the engine actually applied, post-normalization. */
  fieldScale: number;
  /** Passes dispatched on the instance's last rendered frame. */
  passes: PassFillSample[];
};

/** One dispatched pass and the render-target area it shaded. */
export type PassFillSample = {
  name: string;
  width: number;
  height: number;
  dispatches: number;
  pixels: number;
};

export type StatsMessage = {
  type: "stats";
  instances: InstanceStatsSample[];
};

export type CellGridResponseMessage = CellGridReadback & {
  type: "cellGridResponse";
  id: InstanceId;
  requestId: number;
};

export type WorkerToMainMessage =
  | ReadyMessage
  | ErrorMessage
  | NeedsSourceMessage
  | FrameMessage
  | TockMessage
  | WaterActivityMessage
  | ShaderSourceErrorMessage
  | CellGridResponseMessage
  | StatsMessage;
