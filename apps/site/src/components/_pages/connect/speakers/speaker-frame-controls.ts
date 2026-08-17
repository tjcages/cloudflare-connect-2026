export type SpeakerFrameSettings = {
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  horizontalSpeed: number;
  verticalSpeed: number;
  cursorWidth: number;
  cursorHeight: number;
  cursorFollow: number;
  shaderOpacity: number;
  cellSize: number;
  brightness: number;
  contrast: number;
};

export const SPEAKER_FRAME_DEFAULTS: SpeakerFrameSettings = {
  frameCount: 6,
  frameWidth: 1,
  frameHeight: 1,
  horizontalSpeed: 1,
  verticalSpeed: 1,
  cursorWidth: 1,
  cursorHeight: 1,
  cursorFollow: 0.22,
  shaderOpacity: 1,
  cellSize: 7,
  brightness: 0,
  contrast: 1,
};

export const SPEAKER_FRAME_PANEL_ID = "connect-speaker-frames-v1";
export const SPEAKER_FRAME_SETTINGS_EVENT = "connect:speaker-frame-settings";

export const loadSpeakerFrameSettings = (): SpeakerFrameSettings => {
  try {
    const raw = localStorage.getItem(`panels:${SPEAKER_FRAME_PANEL_ID}`);
    if (!raw) return { ...SPEAKER_FRAME_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SpeakerFrameSettings>;
    const settings = { ...SPEAKER_FRAME_DEFAULTS };
    for (const key of Object.keys(settings) as (keyof SpeakerFrameSettings)[]) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value))
        settings[key] = value;
    }
    return settings;
  } catch {
    return { ...SPEAKER_FRAME_DEFAULTS };
  }
};

export const publishSpeakerFrameSettings = (settings: SpeakerFrameSettings) => {
  window.dispatchEvent(
    new CustomEvent<SpeakerFrameSettings>(SPEAKER_FRAME_SETTINGS_EVENT, {
      detail: settings,
    })
  );
};
