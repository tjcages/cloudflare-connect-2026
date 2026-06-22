/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlaygroundLevaControls } from "./playgroundLevaControls";
import {
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG,
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  DEFAULT_PLAYGROUND_GRID_CONFIG,
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  cloneDefaultStripes,
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  DEFAULT_TEXTURE_LUMINANCE_MODE,
} from "@necatikcl/stripes-shader";
import {
  buildPlaygroundLevaSchema,
  buildPlaygroundLevaSyncValues,
  type PlaygroundLevaHandlers,
  type PlaygroundLevaSnapshot,
} from "./playgroundLevaSchema";
import { DEFAULT_PLAYGROUND_BACKGROUND_COLOR } from "./canvasBackgroundCss";
import type { PlaygroundTextureId } from "./playgroundTextures";

const DEFAULT_TEXTURE_ID = "sample-video" as PlaygroundTextureId;
const SHADER_RESET_KEYS = [
  ["General", "generalReset"],
  ["Reveal", "revealReset"],
  ["Texture Tone", "textureToneReset"],
  ["Texture Levels", "textureLevelsReset"],
  ["Texture Source", "textureSourceReset"],
  ["Background", "backgroundReset"],
  ["Grid", "gridReset"],
  ["Letters", "lettersReset"],
  ["Stripes", "stripesReset"],
  ["Sparkle Gaps", "sparkleGapsReset"],
  ["Sparkle Width", "sparkleWidthReset"],
  ["Background Flames", "backgroundFlamesReset"],
  ["Edge Mask", "edgeMaskReset"],
  ["Cursor Trail", "cursorTrailReset"],
  ["Cursor Click", "cursorClickReset"],
] as const;

function renderLevaControls(overrides: Partial<ComponentProps<typeof PlaygroundLevaControls>> = {}) {
  return render(
    <PlaygroundLevaControls
      catalog={[
        {
          id: DEFAULT_TEXTURE_ID,
          label: "Sample video",
          url: "/sample.mp4",
          mediaKind: "video",
          displayScale: 0.5,
          stripes: [],
          isUpload: false,
        },
      ]}
      selectedTextureId={DEFAULT_TEXTURE_ID}
      onTextureSelect={() => {}}
      displayWidth={640}
      displayHeight={360}
      sourceWidth={1280}
      sourceHeight={720}
      onDisplayWidthChange={() => {}}
      onDisplayHeightChange={() => {}}
      applyDisplayScale={() => {}}
      onUploadFile={() => {}}
      importText=""
      onImportTextChange={() => {}}
      onCopyState={() => {}}
      onCopyConfig={() => {}}
      onImportState={() => {}}
      importStatus={null}
      uploadError={null}
      workflowDisabled={false}
      duotoneEnabled
      onDuotoneEnabledChange={() => {}}
      duotoneControlsDisabled={false}
      textureAdjustments={DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS}
      onAdjustmentsChange={() => {}}
      onLiveAdjustmentsChange={() => {}}
      onResetTone={() => {}}
      onResetEffects={() => {}}
      toneModified={false}
      effectsModified={false}
      sourceTransform={DEFAULT_PLAYGROUND_SOURCE_TRANSFORM}
      onSourceTransformChange={() => {}}
      onLiveSourceTransformChange={() => {}}
      onResetSource={() => {}}
      sourceModified={false}
      backgroundColor={DEFAULT_PLAYGROUND_BACKGROUND_COLOR}
      backgroundCss=""
      backgroundCssActive={false}
      onBackgroundColorChange={() => {}}
      onBackgroundCssChange={() => {}}
      onResetBackground={() => {}}
      backgroundModified={false}
      gridConfig={DEFAULT_PLAYGROUND_GRID_CONFIG}
      onGridChange={() => {}}
      onGridLiveChange={() => {}}
      onResetGrid={() => {}}
      onResetLetters={() => {}}
      gridModified={false}
      lettersModified={false}
      stripes={cloneDefaultStripes()}
      stripesEnabled
      textureLuminanceSettings={{
        mode: DEFAULT_TEXTURE_LUMINANCE_MODE,
        backgroundColor: DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
      }}
      onStripesEnabledChange={() => {}}
      onTextureLuminanceSettingsChange={() => {}}
      onStripeColorChange={() => {}}
      onStripeStartFromCommit={() => {}}
      onStripeWidthCommit={() => {}}
      onStripeColorReorder={() => {}}
      onResetStripes={() => {}}
      stripesModified={false}
      sparkleGapsActivePercent={0}
      sparkleGapsSpeed={1}
      setSparkleGapsActivePercentLive={() => {}}
      commitSparkleGapsActivePercent={() => {}}
      setSparkleGapsSpeedLive={() => {}}
      commitSparkleGapsSpeed={() => {}}
      onResetSparkleGaps={() => {}}
      sparkleGapsModified={false}
      sparkleWidthActivePercent={0.3}
      sparkleWidthSpeed={1}
      setSparkleWidthActivePercentLive={() => {}}
      commitSparkleWidthActivePercent={() => {}}
      setSparkleWidthSpeedLive={() => {}}
      commitSparkleWidthSpeed={() => {}}
      onResetSparkleWidth={() => {}}
      sparkleWidthModified={false}
      flamesConfig={DEFAULT_PLAYGROUND_FLAMES_CONFIG}
      onFlamesChange={() => {}}
      onFlamesLiveChange={() => {}}
      onResetFlames={() => {}}
      flamesModified={false}
      edgeMaskConfig={DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG}
      onEdgeMaskChange={() => {}}
      onEdgeMaskLiveChange={() => {}}
      onResetEdgeMask={() => {}}
      edgeMaskModified={false}
      cursorTrailConfig={DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG}
      onCursorTrailChange={() => {}}
      onCursorTrailLiveChange={() => {}}
      onResetCursorTrail={() => {}}
      cursorTrailModified={false}
      clickWaveConfig={DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG}
      onClickWaveChange={() => {}}
      onClickWaveLiveChange={() => {}}
      onResetClickWave={() => {}}
      cursorClickModified={false}
      revealConfig={DEFAULT_PLAYGROUND_REVEAL_CONFIG}
      onRevealChange={() => {}}
      onRevealLiveChange={() => {}}
      onRevealWaveLiveChange={() => {}}
      onRevealAssemblyLiveChange={() => {}}
      onResetReveal={() => {}}
      onReplayReveal={() => {}}
      revealModified={false}
      onResetGeneral={() => {}}
      generalModified={false}
      debugStage="normal"
      onDebugStageChange={() => {}}
      {...overrides}
    />,
  );
}

describe("PlaygroundLevaControls", () => {
  it("renders the embedded Leva config panel", () => {
    renderLevaControls();
    expect(screen.getByTestId("playground-leva-panel")).toBeInTheDocument();
  });

  it("does not emit Leva schema or sync warnings while rendering", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderLevaControls();

    const levaWarnings = warn.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes("LEVA:") || message.includes("`set` for path"));
    expect(levaWarnings).toEqual([]);
    warn.mockRestore();
  });

  it("wires shader toggle changes through the callback", () => {
    const onDuotoneEnabledChange = vi.fn();
    renderLevaControls({ onDuotoneEnabledChange, duotoneEnabled: true });

    const checkbox = screen.getByLabelText("Shader enabled");
    checkbox.click();
    expect(onDuotoneEnabledChange).toHaveBeenCalledWith(false);
  });

  it("renders reveal controls in the Leva panel", () => {
    renderLevaControls();

    expect(screen.getByText("Reveal")).toBeInTheDocument();
    expect(screen.getByLabelText("Reveal enabled")).toBeInTheDocument();
    expect(screen.getByLabelText("Position")).toBeInTheDocument();
  });

  it("wires reveal enabled toggle changes through the callback", () => {
    const onRevealChange = vi.fn();
    const onRevealLiveChange = vi.fn();
    renderLevaControls({
      revealConfig: { ...DEFAULT_PLAYGROUND_REVEAL_CONFIG, enabled: true },
      onRevealChange,
      onRevealLiveChange,
    });

    const checkbox = screen.getByLabelText("Reveal enabled");
    checkbox.click();
    expect(onRevealLiveChange).toHaveBeenCalledWith({ enabled: false });
    expect(onRevealChange).toHaveBeenCalledWith({ enabled: false });
  });

  it("renders the stripe colors table inside the Leva panel instead of per-stripe labels", () => {
    renderLevaControls();

    const table = document.querySelector(".playground-leva-panel .stripe-colors-table");
    expect(table).not.toBeNull();
    expect(table).toHaveTextContent("Color");
    expect(table).toHaveTextContent("Threshold");
    expect(table).toHaveTextContent("Width");
    expect(screen.queryByLabelText("Loud color")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Gray threshold")).not.toBeInTheDocument();
  });

  it("wires stripe threshold changes through the callback", () => {
    const onStripeStartFromCommit = vi.fn();
    const stripes = cloneDefaultStripes();
    renderLevaControls({ onStripeStartFromCommit, stripes });

    fireEvent.change(screen.getByLabelText("Stripe 1 threshold"), { target: { value: "0.2" } });
    expect(onStripeStartFromCommit).toHaveBeenCalledWith(stripes[0]!.id, 0.2);
  });

  it("renders a reorder grip handle for each stripe color", () => {
    renderLevaControls({ stripes: cloneDefaultStripes() });

    expect(screen.getAllByLabelText(/^Reorder Stripe \d+ color$/)).toHaveLength(6);
  });

  it("renders canvas controls, presets, and workflow above shader folders", () => {
    renderLevaControls();

    expect(screen.getByTestId("playground-canvas-leva-panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Width")).toBeInTheDocument();
    expect(screen.getByLabelText("Height")).toBeInTheDocument();
    expect(screen.getByTestId("playground-canvas-size-controls")).toBeInTheDocument();
    expect(screen.getByText("Presets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1x" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2x" })).toBeInTheDocument();
    expect(screen.getByTestId("playground-workflow-controls")).toBeInTheDocument();
    expect(screen.getByTestId("playground-workflow-import-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload texture" })).toBeInTheDocument();
    expect(screen.queryByText("Workflow")).not.toBeInTheDocument();
  });

  it("hides stripe tuning controls in colors mode", () => {
    const noop = () => {};
    const snapshot: PlaygroundLevaSnapshot = {
      duotoneEnabled: true,
      duotoneControlsDisabled: false,
      backgroundCssActive: false,
      stripeControlsDisabled: false,
      sparkleGapsSpeedDisabled: false,
      sparkleWidthSpeedDisabled: false,
      flamesFieldsDisabled: false,
      edgeMaskFieldsDisabled: false,
      cursorTrailFieldsDisabled: false,
      cursorClickFieldsDisabled: false,
      revealFieldsDisabled: true,
      textureAdjustments: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      sourceTransform: DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
      backgroundColor: DEFAULT_PLAYGROUND_BACKGROUND_COLOR,
      backgroundCss: "",
      gridConfig: DEFAULT_PLAYGROUND_GRID_CONFIG,
      stripes: cloneDefaultStripes(),
      stripesEnabled: true,
      textureLuminanceSettings: { mode: "colors", backgroundColor: DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR },
      sparkleGapsActivePercent: 0,
      sparkleGapsSpeed: 1,
      sparkleWidthActivePercent: 0.3,
      sparkleWidthSpeed: 1,
      flamesConfig: DEFAULT_PLAYGROUND_FLAMES_CONFIG,
      edgeMaskConfig: DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG,
      cursorTrailConfig: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
      clickWaveConfig: DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
      revealConfig: DEFAULT_PLAYGROUND_REVEAL_CONFIG,
      generalModified: false,
      toneModified: false,
      effectsModified: false,
      sourceModified: false,
      backgroundModified: false,
      gridModified: false,
      lettersModified: false,
      stripesModified: false,
      sparkleGapsModified: false,
      sparkleWidthModified: false,
      flamesModified: false,
      edgeMaskModified: false,
      cursorTrailModified: false,
      cursorClickModified: false,
      revealModified: false,
      debugStage: "normal" as const,
    };
    const handlers: PlaygroundLevaHandlers = {
      setDuotoneEnabled: noop,
      resetGeneral: noop,
      onAdjustmentsLive: noop,
      onAdjustmentsCommit: noop,
      resetTone: noop,
      resetEffects: noop,
      onSourceLive: noop,
      onSourceCommit: noop,
      resetSource: noop,
      setBackgroundColor: noop,
      setBackgroundCss: noop,
      resetBackground: noop,
      onGridLive: noop,
      onGridCommit: noop,
      resetGrid: noop,
      resetLetters: noop,
      setStripesEnabled: noop,
      setTextureLuminanceSettings: noop,
      onStripeColorChange: noop,
      onStripeStartFromCommit: noop,
      onStripeWidthCommit: noop,
      onStripeColorReorder: noop,
      resetStripes: noop,
      setSparkleGapsActivePercentLive: noop,
      commitSparkleGapsActivePercent: noop,
      setSparkleGapsSpeedLive: noop,
      commitSparkleGapsSpeed: noop,
      resetSparkleGaps: noop,
      setSparkleWidthActivePercentLive: noop,
      commitSparkleWidthActivePercent: noop,
      setSparkleWidthSpeedLive: noop,
      commitSparkleWidthSpeed: noop,
      resetSparkleWidth: noop,
      onFlamesLive: noop,
      onFlamesCommit: noop,
      resetFlames: noop,
      onEdgeMaskLive: noop,
      onEdgeMaskCommit: noop,
      resetEdgeMask: noop,
      onCursorTrailLive: noop,
      onCursorTrailCommit: noop,
      resetCursorTrail: noop,
      onClickWaveLive: noop,
      onClickWaveCommit: noop,
      resetClickWave: noop,
      onRevealLive: noop,
      onRevealCommit: noop,
      onRevealWaveLive: noop,
      onRevealWaveCommit: noop,
      onRevealAssemblyLive: noop,
      onRevealAssemblyCommit: noop,
      resetReveal: noop,
      replayReveal: noop,
      onDebugStageChange: noop,
    };
    const schema = buildPlaygroundLevaSchema(snapshot, handlers);

    const stripesFolder = schema.Stripes as { schema?: Record<string, unknown> };
    const stripes = stripesFolder.schema ?? (schema.Stripes as Record<string, unknown>);
    expect(stripes).toHaveProperty("textureLuminanceMode");
    expect(stripes).not.toHaveProperty("stripe_gray_startFrom");
    expect(stripes).not.toHaveProperty("stripe_gray_width");
    expect(stripes).not.toHaveProperty("stripe_gray_color");
    expect(stripes).not.toHaveProperty("textureLuminanceBackgroundColor");
    expect(stripes).toHaveProperty("gridUpdateIntervalMs");
    expect(stripes).not.toHaveProperty("stripeColorsTable");

    const syncValues = buildPlaygroundLevaSyncValues(snapshot);
    expect(syncValues).not.toHaveProperty("stripeColorsTable");
    expect(syncValues).not.toHaveProperty("textureLuminanceBackgroundColor");
  });

  it("uses unique internal keys for reset buttons while preserving their labels", () => {
    const noop = () => {};
    const snapshot: PlaygroundLevaSnapshot = {
      duotoneEnabled: true,
      duotoneControlsDisabled: false,
      backgroundCssActive: false,
      stripeControlsDisabled: false,
      sparkleGapsSpeedDisabled: false,
      sparkleWidthSpeedDisabled: false,
      flamesFieldsDisabled: false,
      edgeMaskFieldsDisabled: false,
      cursorTrailFieldsDisabled: false,
      cursorClickFieldsDisabled: false,
      revealFieldsDisabled: true,
      textureAdjustments: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      sourceTransform: DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
      backgroundColor: DEFAULT_PLAYGROUND_BACKGROUND_COLOR,
      backgroundCss: "",
      gridConfig: DEFAULT_PLAYGROUND_GRID_CONFIG,
      stripes: cloneDefaultStripes(),
      stripesEnabled: true,
      textureLuminanceSettings: {
        mode: DEFAULT_TEXTURE_LUMINANCE_MODE,
        backgroundColor: DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
      },
      sparkleGapsActivePercent: 0,
      sparkleGapsSpeed: 1,
      sparkleWidthActivePercent: 0.3,
      sparkleWidthSpeed: 1,
      flamesConfig: DEFAULT_PLAYGROUND_FLAMES_CONFIG,
      edgeMaskConfig: DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG,
      cursorTrailConfig: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
      clickWaveConfig: DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
      revealConfig: DEFAULT_PLAYGROUND_REVEAL_CONFIG,
      generalModified: false,
      toneModified: false,
      effectsModified: false,
      sourceModified: false,
      backgroundModified: false,
      gridModified: false,
      lettersModified: false,
      stripesModified: false,
      sparkleGapsModified: false,
      sparkleWidthModified: false,
      flamesModified: false,
      edgeMaskModified: false,
      cursorTrailModified: false,
      cursorClickModified: false,
      revealModified: false,
      debugStage: "normal" as const,
    };
    const handlers: PlaygroundLevaHandlers = {
      setDuotoneEnabled: noop,
      resetGeneral: noop,
      onAdjustmentsLive: noop,
      onAdjustmentsCommit: noop,
      resetTone: noop,
      resetEffects: noop,
      onSourceLive: noop,
      onSourceCommit: noop,
      resetSource: noop,
      setBackgroundColor: noop,
      setBackgroundCss: noop,
      resetBackground: noop,
      onGridLive: noop,
      onGridCommit: noop,
      resetGrid: noop,
      resetLetters: noop,
      setStripesEnabled: noop,
      setTextureLuminanceSettings: noop,
      onStripeColorChange: noop,
      onStripeStartFromCommit: noop,
      onStripeWidthCommit: noop,
      onStripeColorReorder: noop,
      resetStripes: noop,
      setSparkleGapsActivePercentLive: noop,
      commitSparkleGapsActivePercent: noop,
      setSparkleGapsSpeedLive: noop,
      commitSparkleGapsSpeed: noop,
      resetSparkleGaps: noop,
      setSparkleWidthActivePercentLive: noop,
      commitSparkleWidthActivePercent: noop,
      setSparkleWidthSpeedLive: noop,
      commitSparkleWidthSpeed: noop,
      resetSparkleWidth: noop,
      onFlamesLive: noop,
      onFlamesCommit: noop,
      resetFlames: noop,
      onEdgeMaskLive: noop,
      onEdgeMaskCommit: noop,
      resetEdgeMask: noop,
      onCursorTrailLive: noop,
      onCursorTrailCommit: noop,
      resetCursorTrail: noop,
      onClickWaveLive: noop,
      onClickWaveCommit: noop,
      resetClickWave: noop,
      onRevealLive: noop,
      onRevealCommit: noop,
      onRevealWaveLive: noop,
      onRevealWaveCommit: noop,
      onRevealAssemblyLive: noop,
      onRevealAssemblyCommit: noop,
      resetReveal: noop,
      replayReveal: noop,
      onDebugStageChange: noop,
    };
    const schema = buildPlaygroundLevaSchema(snapshot, handlers);

    for (const [folderName, resetKey] of SHADER_RESET_KEYS) {
      const folder = schema[folderName] as { schema?: Record<string, { label?: string }> };
      const controls = folder.schema ?? {};
      expect(controls).not.toHaveProperty("Reset");
      expect(controls[resetKey]).toMatchObject({ label: "Reset" });
    }
  });

  it("shows the stripe color table in overlay mode", () => {
    const noop = () => {};
    const snapshot: PlaygroundLevaSnapshot = {
      duotoneEnabled: true,
      duotoneControlsDisabled: false,
      backgroundCssActive: false,
      stripeControlsDisabled: false,
      sparkleGapsSpeedDisabled: false,
      sparkleWidthSpeedDisabled: false,
      flamesFieldsDisabled: false,
      edgeMaskFieldsDisabled: false,
      cursorTrailFieldsDisabled: false,
      cursorClickFieldsDisabled: false,
      revealFieldsDisabled: true,
      textureAdjustments: DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
      sourceTransform: DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
      backgroundColor: DEFAULT_PLAYGROUND_BACKGROUND_COLOR,
      backgroundCss: "",
      gridConfig: DEFAULT_PLAYGROUND_GRID_CONFIG,
      stripes: cloneDefaultStripes().slice(3),
      stripesEnabled: true,
      textureLuminanceSettings: { mode: "overlay", backgroundColor: DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR },
      sparkleGapsActivePercent: 0,
      sparkleGapsSpeed: 1,
      sparkleWidthActivePercent: 0.3,
      sparkleWidthSpeed: 1,
      flamesConfig: DEFAULT_PLAYGROUND_FLAMES_CONFIG,
      edgeMaskConfig: DEFAULT_PLAYGROUND_EDGE_MASK_CONFIG,
      cursorTrailConfig: DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
      clickWaveConfig: DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG,
      revealConfig: DEFAULT_PLAYGROUND_REVEAL_CONFIG,
      generalModified: false,
      toneModified: false,
      effectsModified: false,
      sourceModified: false,
      backgroundModified: false,
      gridModified: false,
      lettersModified: false,
      stripesModified: false,
      sparkleGapsModified: false,
      sparkleWidthModified: false,
      flamesModified: false,
      edgeMaskModified: false,
      cursorTrailModified: false,
      cursorClickModified: false,
      revealModified: false,
      debugStage: "normal" as const,
    };
    const handlers: PlaygroundLevaHandlers = {
      setDuotoneEnabled: noop,
      resetGeneral: noop,
      onAdjustmentsLive: noop,
      onAdjustmentsCommit: noop,
      resetTone: noop,
      resetEffects: noop,
      onSourceLive: noop,
      onSourceCommit: noop,
      resetSource: noop,
      setBackgroundColor: noop,
      setBackgroundCss: noop,
      resetBackground: noop,
      onGridLive: noop,
      onGridCommit: noop,
      resetGrid: noop,
      resetLetters: noop,
      setStripesEnabled: noop,
      setTextureLuminanceSettings: noop,
      onStripeColorChange: noop,
      onStripeStartFromCommit: noop,
      onStripeWidthCommit: noop,
      onStripeColorReorder: noop,
      resetStripes: noop,
      setSparkleGapsActivePercentLive: noop,
      commitSparkleGapsActivePercent: noop,
      setSparkleGapsSpeedLive: noop,
      commitSparkleGapsSpeed: noop,
      resetSparkleGaps: noop,
      setSparkleWidthActivePercentLive: noop,
      commitSparkleWidthActivePercent: noop,
      setSparkleWidthSpeedLive: noop,
      commitSparkleWidthSpeed: noop,
      resetSparkleWidth: noop,
      onFlamesLive: noop,
      onFlamesCommit: noop,
      resetFlames: noop,
      onEdgeMaskLive: noop,
      onEdgeMaskCommit: noop,
      resetEdgeMask: noop,
      onCursorTrailLive: noop,
      onCursorTrailCommit: noop,
      resetCursorTrail: noop,
      onClickWaveLive: noop,
      onClickWaveCommit: noop,
      resetClickWave: noop,
      onRevealLive: noop,
      onRevealCommit: noop,
      onRevealWaveLive: noop,
      onRevealWaveCommit: noop,
      onRevealAssemblyLive: noop,
      onRevealAssemblyCommit: noop,
      resetReveal: noop,
      replayReveal: noop,
      onDebugStageChange: noop,
    };
    const schema = buildPlaygroundLevaSchema(snapshot, handlers);

    const stripesFolder = schema.Stripes as { schema?: Record<string, unknown> };
    const stripes = stripesFolder.schema ?? (schema.Stripes as Record<string, unknown>);
    expect(stripes).toHaveProperty("stripeColorsTable");
    expect((stripes.textureLuminanceMode as { value?: string }).value).toBe("overlay");

    const syncValues = buildPlaygroundLevaSyncValues(snapshot);
    expect(syncValues).toHaveProperty("stripeColorsTable");
    expect(syncValues).not.toHaveProperty("textureLuminanceBackgroundColor");
  });
});
