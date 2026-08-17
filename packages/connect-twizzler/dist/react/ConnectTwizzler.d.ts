import { CSSProperties, Ref } from 'react';
import { TwizzlerSettings } from '../twizzler';
export type ConnectTwizzlerProps = {
    settings?: Partial<TwizzlerSettings>;
    posterSrc?: string;
    className?: string;
    canvasClassName?: string;
    style?: CSSProperties;
    rootMargin?: string;
    maxFps?: number;
    maxDpr?: number;
    paused?: boolean;
    onReady?: () => void;
    ref?: Ref<HTMLCanvasElement>;
};
export declare function ConnectTwizzler({ settings, posterSrc, className, canvasClassName, style, rootMargin, maxFps, maxDpr, paused, onReady, ref, }: ConnectTwizzlerProps): import("react").JSX.Element;
