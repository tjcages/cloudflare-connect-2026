import type { EngineConfig } from "../config/types";

export type InstanceId = string;

export type SharedSourceFrame = ImageBitmap | VideoFrame;

export type RegisterMessage = {
  type: "register";
  id: InstanceId;
  canvas: OffscreenCanvas;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  config?: Partial<EngineConfig>;
  seed?: number;
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

export type MainToWorkerMessage =
  | RegisterMessage
  | ResizeMessage
  | VisibilityMessage
  | SourceMessage
  | SetConfigMessage
  | CursorMessage
  | ClickMessage
  | RevealMessage
  | UnregisterMessage
  | TerminateMessage;

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

export type WorkerToMainMessage = ReadyMessage | ErrorMessage | NeedsSourceMessage;
