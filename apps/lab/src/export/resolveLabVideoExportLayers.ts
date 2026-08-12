export type LabVideoExportLayerInputs = {
  engineCanvas: HTMLCanvasElement;
  twizzlerCanvas?: HTMLCanvasElement | null;
  framesCanvas?: HTMLCanvasElement | null;
  twizzlerVisible: boolean;
  /** When false (client Rain off), skip the opaque engine pass that would blank Twizzler. */
  rainVisible: boolean;
  framesEnabled: boolean;
};

export type LabVideoExportLayers = {
  canvas: HTMLCanvasElement;
  underlayCanvases?: HTMLCanvasElement[];
  overlayCanvases?: HTMLCanvasElement[];
};

function usableCanvas(canvas: HTMLCanvasElement | null | undefined): HTMLCanvasElement | null {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  return canvas;
}

/**
 * Match the on-screen stack for MediaRecorder:
 * background → Twizzler (under) → rain/engine output → frames (over).
 * Client Rain-off hides the engine canvas with CSS opacity; export must not record that empty pass alone.
 */
export function resolveLabVideoExportLayers(input: LabVideoExportLayerInputs): LabVideoExportLayers {
  const twizzler = input.twizzlerVisible ? usableCanvas(input.twizzlerCanvas) : null;
  const frames = input.framesEnabled ? usableCanvas(input.framesCanvas) : null;
  const overlayCanvases = frames ? [frames] : undefined;

  if (twizzler && input.rainVisible) {
    return {
      canvas: input.engineCanvas,
      underlayCanvases: [twizzler],
      overlayCanvases,
    };
  }

  if (twizzler) {
    return {
      canvas: twizzler,
      overlayCanvases,
    };
  }

  return {
    canvas: input.engineCanvas,
    overlayCanvases,
  };
}
