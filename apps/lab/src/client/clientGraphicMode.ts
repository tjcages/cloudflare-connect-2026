export const CLIENT_GRAPHIC_MODES = ["twizzler", "rain", "both"] as const;

export type ClientGraphicMode = (typeof CLIENT_GRAPHIC_MODES)[number];

export type ClientGraphicFlags = {
  twizzlerEnabled: boolean;
  rainEnabled: boolean;
};

export function isClientGraphicMode(value: unknown): value is ClientGraphicMode {
  return value === "twizzler" || value === "rain" || value === "both";
}

/** Map Graphic toggle → Show/Rain flags. Both-off is not a mode; Twizzler is the default. */
export function flagsFromGraphicMode(mode: ClientGraphicMode): ClientGraphicFlags {
  switch (mode) {
    case "twizzler":
      return { twizzlerEnabled: true, rainEnabled: false };
    case "rain":
      return { twizzlerEnabled: false, rainEnabled: true };
    case "both":
      return { twizzlerEnabled: true, rainEnabled: true };
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Derive Graphic mode from persisted Show/Rain flags. Both-off normalizes to Twizzler. */
export function graphicModeFromFlags(twizzlerEnabled: boolean, rainEnabled: boolean): ClientGraphicMode {
  if (twizzlerEnabled && rainEnabled) return "both";
  if (!twizzlerEnabled && rainEnabled) return "rain";
  return "twizzler";
}
