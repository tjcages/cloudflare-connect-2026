import type { EngineConfig } from "../config/types";

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

export type MainToWorkerMessage =
  | RegisterMessage
  | TickMessage
  | ResizeMessage
  | VisibilityMessage
  | SourceMessage
  | SetConfigMessage
  | CursorMessage
  | ClickMessage
  | RevealMessage
  | RevealGateMessage
  | UnregisterMessage
  | TerminateMessage
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

/**
 * One instance's finished frame. `frame` is the whole shared backbuffer, which
 * is grow-only and therefore at least as large as this instance; the rendered
 * region is the bottom-left `outWidth × outHeight` corner (GL's origin), so the
 * host crops it out with a source rect while blitting.
 */
export type FrameMessage = {
  type: "frame";
  id: InstanceId;
  frame: ImageBitmap;
  outWidth: number;
  outHeight: number;
};

export type TockMessage = {
  type: "tock";
};

export type WaterActivityMessage = {
  type: "waterActivity";
  id: InstanceId;
  activity: number;
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
};

export type StatsMessage = {
  type: "stats";
  instances: InstanceStatsSample[];
};

export type WorkerToMainMessage =
  | ReadyMessage
  | ErrorMessage
  | NeedsSourceMessage
  | FrameMessage
  | TockMessage
  | WaterActivityMessage
  | StatsMessage;
