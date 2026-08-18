import { createContext, useContext, useState } from 'react';

// src/types.ts
function isPanelSection(field) {
  return field.type === "section";
}
function createOverlayProjector() {
  return { register: () => () => {
  }, destroy: () => {
  } };
}
var NOOP = () => {
};
var NULL_COMPONENT = () => null;
var PANEL_CSS = "";
var PANEL_STYLE_ID = "shader-dev-styles";
var PANEL_TOGGLE_EVENT = "cf-shader-dev-toggle";
function registerPanel() {
  return NOOP;
}
var unregisterPanel = NOOP;
var setActivePanel = NOOP;
function getActivePanel() {
  return null;
}
function getActivePanelId() {
  return null;
}
function getActivePanelIdForSide() {
  return null;
}
function getActivePanelForSide() {
  return null;
}
function getPanelRegistration() {
  return null;
}
var EMPTY_MAP = /* @__PURE__ */ new Map();
function getPanelRegistrations() {
  return EMPTY_MAP;
}
function getPanelRegistrationsForSide() {
  return [];
}
function getPanelRevision() {
  return 0;
}
function subscribePanelRegistration() {
  return NOOP;
}
function registerShaderCapture() {
  return NOOP;
}
function getShaderCapture() {
  return null;
}
function subscribeShaderCapture() {
  return NOOP;
}
function registerShaderRecordCanvas() {
  return NOOP;
}
function getShaderRecordCanvas() {
  return null;
}
function registerShaderRecordPrepare() {
  return NOOP;
}
function getShaderRecordPrepare() {
  return null;
}
function registerShaderRecordFrame() {
  return NOOP;
}
function getShaderRecordFrame() {
  return null;
}
function registerShaderGifExport() {
  return NOOP;
}
function getShaderGifExport() {
  return null;
}
function registerShaderVideoExport() {
  return NOOP;
}
function getShaderVideoExport() {
  return null;
}
function subscribeShaderRecording() {
  return NOOP;
}
function setShaderRecording() {
}
var PANEL_ANIMATION_STEP = 1 / 30;
var prodAnimStart = typeof performance !== "undefined" ? performance.now() : 0;
function getPanelAnimationTime() {
  return (performance.now() - prodAnimStart) / 1e3;
}
function advancePanelAnimationDelta(previousTime) {
  const nextTime = getPanelAnimationTime();
  const delta = Math.min(Math.max(0, nextTime - previousTime), 0.1);
  return { time: nextTime, delta };
}
function getPanelAnimationSnapshot() {
  return { playing: true, time: getPanelAnimationTime(), rate: 1 };
}
var playPanelAnimation = NOOP;
var pausePanelAnimation = NOOP;
var togglePanelAnimation = NOOP;
var stepPanelAnimationForward = NOOP;
var stepPanelAnimationBackward = NOOP;
var resetPanelAnimation = () => {
  prodAnimStart = performance.now();
};
var setPanelAnimationTime = NOOP;
var setPanelAnimationRate = NOOP;
function getPanelAnimationRevision() {
  return 0;
}
function subscribePanelAnimation() {
  return NOOP;
}
var initPanelAnimationClock = NOOP;
function loadPersistedPanelValues(_id, defaults) {
  return { ...defaults };
}
var persistPanelValues = NOOP;
var clearPersistedPanelValues = NOOP;
function hasPersistedPanelValues() {
  return false;
}
function loadPersistedPanelSections() {
  return {};
}
var persistPanelSections = NOOP;
var dispatchPanelToggle = NOOP;
function readPanelOpenFlag() {
  return false;
}
var writePanelOpenFlag = NOOP;
var usePanelShortcut = NOOP;
var handlePanelShortcutKeydown = NOOP;
function installPanelKeyboard() {
  return NOOP;
}
function matchPanelShortcut() {
  return false;
}
var ThemeContext = createContext("dark");
var PanelThemeProvider = ThemeContext.Provider;
function usePanelTheme() {
  return "dark";
}
function usePanelThemeContext() {
  return useContext(ThemeContext);
}
function usePanel(options) {
  return useState(() => ({ ...options.defaults }));
}
function renderPanelField() {
  return null;
}
var PanelRoot = NULL_COMPONENT;
var Panel = NULL_COMPONENT;
var FloatingPanel = NULL_COMPONENT;
var ToolShell = NULL_COMPONENT;
var ToolPanel = NULL_COMPONENT;
var PanelToolPanel = NULL_COMPONENT;
var PanelToggleButton = NULL_COMPONENT;
var EyeToggle = NULL_COMPONENT;
var PanelShortcutBridge = NULL_COMPONENT;
var ControlSlider = NULL_COMPONENT;
var ControlSection = NULL_COMPONENT;
var ControlColorInput = NULL_COMPONENT;
var ColorPopover = NULL_COMPONENT;
var colorPopoverStyles = "";
var ControlImageInput = NULL_COMPONENT;
var ControlPath = NULL_COMPONENT;
var ControlToggle = NULL_COMPONENT;
var ControlToggleGroup = NULL_COMPONENT;
var ControlSelect = NULL_COMPONENT;
var ControlVec2 = NULL_COMPONENT;
var ControlPresets = NULL_COMPONENT;
var ControlCollection = NULL_COMPONENT;
var ControlReference = NULL_COMPONENT;
var ControlQuickActions = NULL_COMPONENT;
var ControlAnimation = NULL_COMPONENT;
var TOOL_PANEL_WIDTH = 280;
var TOOL_PANEL_INSET = 16;
var TOOL_PANEL_FULL = 296;

export { ColorPopover, ControlAnimation, ControlCollection, ControlColorInput, ControlImageInput, ControlPath, ControlPresets, ControlQuickActions, ControlReference, ControlSection, ControlSelect, ControlSlider, ControlToggle, ControlToggleGroup, ControlVec2, EyeToggle, FloatingPanel, PANEL_ANIMATION_STEP, PANEL_CSS, PANEL_STYLE_ID, PANEL_TOGGLE_EVENT, Panel, PanelRoot, PanelShortcutBridge, PanelThemeProvider, PanelToggleButton, PanelToolPanel, TOOL_PANEL_FULL, TOOL_PANEL_INSET, TOOL_PANEL_WIDTH, ToolPanel, ToolShell, advancePanelAnimationDelta, clearPersistedPanelValues, colorPopoverStyles, createOverlayProjector, dispatchPanelToggle, getActivePanel, getActivePanelForSide, getActivePanelId, getActivePanelIdForSide, getPanelAnimationRevision, getPanelAnimationSnapshot, getPanelAnimationTime, getPanelRegistration, getPanelRegistrations, getPanelRegistrationsForSide, getPanelRevision, getShaderCapture, getShaderGifExport, getShaderRecordCanvas, getShaderRecordFrame, getShaderRecordPrepare, getShaderVideoExport, handlePanelShortcutKeydown, hasPersistedPanelValues, initPanelAnimationClock, installPanelKeyboard, isPanelSection, loadPersistedPanelSections, loadPersistedPanelValues, matchPanelShortcut, pausePanelAnimation, persistPanelSections, persistPanelValues, playPanelAnimation, readPanelOpenFlag, registerPanel, registerShaderCapture, registerShaderGifExport, registerShaderRecordCanvas, registerShaderRecordFrame, registerShaderRecordPrepare, registerShaderVideoExport, renderPanelField, resetPanelAnimation, setActivePanel, setPanelAnimationRate, setPanelAnimationTime, setShaderRecording, stepPanelAnimationBackward, stepPanelAnimationForward, subscribePanelAnimation, subscribePanelRegistration, subscribeShaderCapture, subscribeShaderRecording, togglePanelAnimation, unregisterPanel, usePanel, usePanelShortcut, usePanelTheme, usePanelThemeContext, writePanelOpenFlag };
//# sourceMappingURL=index.prod.js.map
//# sourceMappingURL=index.prod.js.map