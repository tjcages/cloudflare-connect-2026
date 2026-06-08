/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { PlaygroundLevaControls } from "./playgroundLevaControls";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG } from "./playgroundFlamesConfig";
import { DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG } from "./playgroundCursorTrailConfig";
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
      matchSourceDisplaySize={() => {}}
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
});
