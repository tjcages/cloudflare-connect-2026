/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
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
        gridModified={false}
        lettersModified={false}
        disabled={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "About Cell width" })).not.toBeInTheDocument();
    expect(screen.getByText("Cell width")).toBeInTheDocument();
    expect(screen.getByText("Orientation")).toBeInTheDocument();
    expect(screen.queryByText("Color smoothing")).not.toBeInTheDocument();
    expect(screen.queryByText("Processing interval")).not.toBeInTheDocument();
    expect(screen.queryByTestId("playground-section-animation-settings")).not.toBeInTheDocument();
  });
});
