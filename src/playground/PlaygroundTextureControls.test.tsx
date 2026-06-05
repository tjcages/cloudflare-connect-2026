/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaygroundTextureControls } from "./PlaygroundTextureControls";
import { DEFAULT_PLAYGROUND_SOURCE_TRANSFORM } from "./playgroundSourceTransform";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";

describe("PlaygroundTextureControls", () => {
  it("renders hover help on texture field labels without help buttons", () => {
    render(
      <PlaygroundTextureControls
        adjustments={DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS}
        sourceTransform={DEFAULT_PLAYGROUND_SOURCE_TRANSFORM}
        onAdjustmentsChange={() => {}}
        onSourceTransformChange={() => {}}
        onResetTone={() => {}}
        onResetSource={() => {}}
        onResetEffects={() => {}}
        toneModified={false}
        sourceModified={false}
        effectsModified={false}
        disabled={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "About Exposure" })).not.toBeInTheDocument();
    expect(screen.getByText("Exposure")).toBeInTheDocument();
    expect(screen.getByText("Black point")).toBeInTheDocument();
    expect(screen.getByText("Fit")).toBeInTheDocument();
  });

  it("emits adjustment and source-transform changes", async () => {
    const onAdjustmentsChange = vi.fn();
    const onSourceTransformChange = vi.fn();

    render(
      <PlaygroundTextureControls
        adjustments={DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS}
        sourceTransform={DEFAULT_PLAYGROUND_SOURCE_TRANSFORM}
        onAdjustmentsChange={onAdjustmentsChange}
        onSourceTransformChange={onSourceTransformChange}
        onResetTone={() => {}}
        onResetSource={() => {}}
        onResetEffects={() => {}}
        toneModified={false}
        sourceModified={false}
        effectsModified={false}
        disabled={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Texture contrast"), { target: { value: "1.5" } });
    fireEvent.blur(screen.getByLabelText("Texture contrast"));
    fireEvent.change(screen.getByLabelText("Texture fit mode"), { target: { value: "cover" } });

    expect(onAdjustmentsChange).toHaveBeenCalledWith({ contrast: 1.5 });
    expect(onSourceTransformChange).toHaveBeenCalledWith({ fit: "cover" });
  });
});
