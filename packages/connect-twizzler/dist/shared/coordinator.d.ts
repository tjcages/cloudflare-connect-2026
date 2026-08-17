import { TwizzlerSettings } from '../twizzler';
export type SharedTwizzlerHandle = {
    readonly supported: boolean;
    setPaused(paused: boolean): void;
    setSettings(settings: Partial<TwizzlerSettings>): void;
    unregister(): void;
};
export type RegisterSharedTwizzlerOptions = {
    canvas: HTMLCanvasElement;
    settings?: Partial<TwizzlerSettings>;
    rootMargin?: string;
    maxFps?: number;
    maxDpr?: number;
    paused?: boolean;
    onReady?: () => void;
};
export declare function registerSharedTwizzler(options: RegisterSharedTwizzlerOptions): SharedTwizzlerHandle;
