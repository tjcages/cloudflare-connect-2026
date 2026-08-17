import { TwizzlerSettings } from '../twizzler';
export type InstanceId = string;
export type MainToWorkerMessage = {
    type: "register";
    id: InstanceId;
    width: number;
    height: number;
    settings?: Partial<TwizzlerSettings>;
    maxFps: number;
    reducedMotion: boolean;
} | {
    type: "resize";
    id: InstanceId;
    width: number;
    height: number;
} | {
    type: "settings";
    id: InstanceId;
    settings: Partial<TwizzlerSettings>;
} | {
    type: "visibility";
    id: InstanceId;
    visible: boolean;
} | {
    type: "reducedMotion";
    id: InstanceId;
    reducedMotion: boolean;
} | {
    type: "tick";
    now: number;
} | {
    type: "unregister";
    id: InstanceId;
} | {
    type: "terminate";
};
export type WorkerToMainMessage = {
    type: "frame";
    id: InstanceId;
    frame: ImageBitmap;
    width: number;
    height: number;
} | {
    type: "tock";
} | {
    type: "error";
    id?: InstanceId;
    message: string;
};
