export const LAB_LEVA_THEME = {
  colors: {
    elevation1: "var(--leva-panel-bg)",
    elevation2: "var(--leva-panel-bg)",
    elevation3: "var(--leva-surface)",
    accent1: "var(--leva-accent-soft)",
    accent2: "var(--leva-text-faint)",
    accent3: "var(--leva-accent-strong)",
    highlight1: "var(--leva-highlight-soft)",
    highlight2: "var(--leva-highlight-mid)",
    highlight3: "var(--leva-text)",
    vivid1: "var(--leva-text-faint)",
    folderWidgetColor: "var(--leva-accent-soft)",
    folderTextColor: "var(--leva-text)",
    toolTipBackground: "#000000",
    toolTipText: "#ffffff",
  },
  shadows: {
    level1: "none",
    level2: "none",
  },
  radii: {
    xs: "2px",
    sm: "4px",
    lg: "6px",
  },
  space: {
    xs: "3px",
    sm: "6px",
    md: "14px",
    rowGap: "8px",
    colGap: "8px",
  },
  fonts: {
    mono: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sans: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  sizes: {
    rootWidth: "360px",
    controlWidth: "155px",
    numberInputMinWidth: "44px",
  },
} as const;
