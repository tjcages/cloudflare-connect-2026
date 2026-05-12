import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies SVG with the configured stroke color", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });
    render(<App />);

    fireEvent.change(screen.getByLabelText("Stroke color"), { target: { value: "#123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy as SVG" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('stroke="#123456"'));
    });
  });
});
