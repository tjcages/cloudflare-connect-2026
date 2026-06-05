/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaygroundGridControls } from "./PlaygroundGridControls";
import { DEFAULT_PLAYGROUND_GRID_CONFIG } from "./playgroundGridConfig";

describe("PlaygroundGridControls", () => {
  it("renders hover help on grid field labels without help buttons", () => {
    render(
      <PlaygroundGridControls
        config={DEFAULT_PLAYGROUND_GRID_CONFIG}
        onChange={() => {}}
        onResetGrid={() => {}}
        onResetLetters={() => {}}
        onResetAnimation={() => {}}
        gridModified={false}
        lettersModified={false}
        animationModified={false}
        disabled={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "About Cell width" })).not.toBeInTheDocument();
    expect(screen.getByText("Cell width")).toBeInTheDocument();
    expect(screen.getByText("Orientation")).toBeInTheDocument();
    expect(screen.getByText("Color smoothing")).toBeInTheDocument();
  });

  it("splits animation ranges from animation settings", () => {
    render(
      <PlaygroundGridControls
        config={DEFAULT_PLAYGROUND_GRID_CONFIG}
        onChange={() => {}}
        onResetGrid={() => {}}
        onResetLetters={() => {}}
        onResetAnimation={() => {}}
        gridModified={false}
        lettersModified={false}
        animationModified={false}
        disabled={false}
      />,
    );

    const ranges = within(screen.getByTestId("playground-section-animation-ranges"));
    expect(ranges.getByText("Gap period min")).toBeInTheDocument();
    expect(ranges.getByText("Width period max")).toBeInTheDocument();
    expect(ranges.queryByText("Width swing")).not.toBeInTheDocument();

    const settings = within(screen.getByTestId("playground-section-animation-settings"));
    expect(settings.getByText("Width swing")).toBeInTheDocument();
    expect(settings.getByText("Color smoothing")).toBeInTheDocument();
    expect(settings.getByText("Update interval")).toBeInTheDocument();
  });
});
