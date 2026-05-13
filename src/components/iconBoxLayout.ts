/** Logical layout for icon-box instances (registry + Pixi agree on these numbers). */

export const ICON_BOX_INNER_OFFSET = 8;
export const ICON_BOX_INNER_SIZE = 64;
export const ICON_BOX_RADIUS = 10;

export const TITLE_BAR_HEIGHT = 16;
export const TITLE_TO_INNER_GAP = 20;
/** Full logical width of the icon-box instance (matches registry width). */
export const TITLE_BAR_WIDTH = 80;
export const TITLE_TEXT_PADDING_X = 6;
export const TITLE_FONT_SIZE_PX = 10;

export const ICON_BOX_INNER_TOP = TITLE_BAR_HEIGHT + TITLE_TO_INNER_GAP;

/** Center of the padded inner card (shadowed roundRect); grid snap aligns this point to BASE_UNIT. */
export const ICON_BOX_INNER_CENTER_X = ICON_BOX_INNER_OFFSET + ICON_BOX_INNER_SIZE / 2;
export const ICON_BOX_INNER_CENTER_Y = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE / 2;

/** Gap between inner card bottom edge and bottom accent bar (logical px). */
export const ICON_BOX_ACCENT_BAR_GAP = 8;
export const ICON_BOX_ACCENT_BAR_WIDTH = 33;
export const ICON_BOX_ACCENT_BAR_HEIGHT = 2;
/** Space below accent bar so warm glow isn’t clipped by bounds / PNG extract. */
export const ICON_BOX_ACCENT_SHADOW_PAD = 20;

export const ICON_BOX_BOTTOM_MARGIN = ICON_BOX_ACCENT_BAR_GAP + ICON_BOX_ACCENT_BAR_HEIGHT + ICON_BOX_ACCENT_SHADOW_PAD;
export const ICON_BOX_OUTER_HEIGHT = ICON_BOX_INNER_TOP + ICON_BOX_INNER_SIZE + ICON_BOX_BOTTOM_MARGIN;

/** Max inner width for title text before clipping (shrink-wrap is capped to full instance width). */
export const TITLE_TEXT_INNER_MAX_WIDTH = TITLE_BAR_WIDTH - TITLE_TEXT_PADDING_X * 2;

export const MARKER_SIZE = 2;
export const MARKER_INSET = 8;

/** Icon hold X inside root (inner left + centered inset). */
export const ICON_HOLD_OFFSET_X = ICON_BOX_INNER_OFFSET + 20;

/** Vertical offset of icon pivot from inner rect top (legacy centered layout). */
export const ICON_HOLD_OFFSET_Y_INNER = 20;
