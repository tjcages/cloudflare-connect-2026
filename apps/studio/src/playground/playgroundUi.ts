export const PLAYGROUND_SHELL_CLASS = "flex h-dvh overflow-hidden bg-builder-hover-surface text-builder-text";

export const PLAYGROUND_LEVA_SIDEBAR_WIDTH_PX = 360;

export const PLAYGROUND_SIDEBAR_CLASS =
  "flex min-h-0 w-[360px] shrink-0 flex-col border-builder-hairline bg-builder-surface";

/** Fixed right rail for the embedded Leva controls panel. */
export const PLAYGROUND_LEVA_SIDEBAR_CLASS =
  "flex min-h-0 w-[360px] shrink-0 flex-col overflow-hidden border-l border-builder-hairline border-r-0 bg-white";

export const PLAYGROUND_FIELD_CLASS = "flex flex-col gap-1.5 text-base text-builder-muted";

export const PLAYGROUND_INLINE_FIELD_CLASS = "flex items-center justify-between gap-2 text-base text-builder-muted";

export const PLAYGROUND_CONTROL_CLASS =
  "builder-field-control text-base disabled:cursor-not-allowed disabled:opacity-45";

export const PLAYGROUND_MONO_CONTROL_CLASS = `${PLAYGROUND_CONTROL_CLASS} font-mono tabular-nums`;

export const PLAYGROUND_TEXTAREA_CLASS = `${PLAYGROUND_CONTROL_CLASS} resize-y font-mono leading-relaxed`;

export const PLAYGROUND_BUTTON_ROW_CLASS = "flex flex-wrap items-center gap-2";

export const PLAYGROUND_CHECKBOX_CLASS =
  "size-4 shrink-0 cursor-pointer rounded border-builder-hairline accent-builder-toggle-knob-on disabled:cursor-not-allowed";

export const PLAYGROUND_MUTED_COPY_CLASS = "m-0 text-base leading-6 text-builder-control";

export const PLAYGROUND_KBD_CLASS =
  "rounded border border-builder-hairline bg-builder-hover-surface px-1.5 py-0.5 text-base font-normal tracking-wide text-builder-control";

export const PLAYGROUND_SWATCH_TRIGGER_CLASS = "h-7 w-12 rounded-md border border-builder-hairline";

/** 24×24 Leva color swatch — matches native Leva picker chips in the sidebar. */
export const PLAYGROUND_LEVA_COLOR_SWATCH_CLASS =
  "stripe-colors-leva-swatch size-6 shrink-0 rounded border border-[#d6d6d6] p-0";

export const PLAYGROUND_SLIDER_ROOT_CLASS =
  "relative flex h-5 w-full touch-none select-none items-center data-[disabled]:cursor-not-allowed";

export const PLAYGROUND_SLIDER_TRACK_CLASS = "relative h-1 grow overflow-hidden rounded-full bg-builder-hairline";

export const PLAYGROUND_SLIDER_RANGE_CLASS = "absolute h-full rounded-full bg-builder-thumb-track";

export const PLAYGROUND_SLIDER_THUMB_CLASS =
  "block size-4 rounded-full border border-builder-thumb-track bg-builder-surface transition-colors hover:border-builder-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-builder-focus-ring data-[disabled]:opacity-45";
