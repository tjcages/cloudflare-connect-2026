/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlaygroundLevaControls } from "./playgroundLevaControls";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG } from "./playgroundFlamesConfig";
import { DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG } from "./playgroundCursorTrailConfig";
import { DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG } from "./playgroundClickWaveConfig";
import { DEFAULT_PLAYGROUND_REVEAL_CONFIG } from "./playgroundRevealConfig";
import { DEFAULT_PLAYGROUND_GRID_CONFIG } from "./playgroundGridConfig";
import { DEFAULT_PLAYGROUND_SOURCE_TRANSFORM } from "./playgroundSourceTransform";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";
import { cloneDefaultStripes } from "./stripeColors";
import { DEFAULT_PLAYGROUND_BACKGROUND_COLOR } from "./canvasBackgroundCss";
import {
  DEFAULT_TEXTURE_LUMINANCE_BACKGROUND_COLOR,
  DEFAULT_TEXTURE_LUMINANCE_MODE,
} from "./colorWhiteness";
import type { PlaygroundTextureId } from "./playgroundTextures";

const DEFAULT_TEXTURE_ID = "sample-video" as PlaygroundTextureId;

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
      onRevealWaveLiveChange={() => {}}
      onRevealRandomColumnsLiveChange={() => {}}
      onResetReveal={() => {}}
      onReplayReveal={() => {}}
      revealModified={false}
      onResetGeneral={() => {}}
      generalModified={false}
      {...overrides}
    />,
  );
}

describe("PlaygroundLevaControls", () => {
  it("renders the embedded Leva config panel", () => {
    renderLevaControls();
    expect(screen.getByTestId("playground-leva-panel")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Preset")).toBeInTheDocument();
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
});
