/** @vitest-environment happy-dom */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StripesShader } from "./StripesShader";

// Mock pixi.js so we don't need a real WebGL environment
vi.mock("pixi.js", () => ({
  Application: class {
    canvas = document.createElement("canvas");
    renderer = { resize: vi.fn(), resolution: 1 };
    ticker = { stop: vi.fn() };
    stage = {};
    init = vi.fn().mockResolvedValue(undefined);
    render = vi.fn();
    destroy = vi.fn();
  },
  WebGLRenderer: class {},
}));

describe("StripesShader", () => {
  it("mounts without throwing and renders a container div", () => {
    const { container } = render(<StripesShader src="test.mp4" config={{}} />);
    // The component renders a div while loading (media hasn't loaded yet in test env)
    expect(container.firstChild).toBeTruthy();
    const div = container.querySelector("div");
    expect(div).toBeTruthy();
  });

  it("accepts all optional props without throwing", () => {
    expect(() => {
      render(
        <StripesShader
          src="test.mp4"
          mediaKind="video"
          config={{ duotoneEnabled: true }}
          width={640}
          height={360}
          autoPlay={false}
          loop={false}
          muted={true}
          paused={true}
          className="test-class"
          style={{ border: "1px solid red" }}
        />,
      );
    }).not.toThrow();
  });

  it("renders a loading placeholder before media resolves", () => {
    const { container } = render(<StripesShader src="test.mp4" />);
    // Should show the loading state (aria-busy) since media hasn't loaded
    const busy = container.querySelector("[aria-busy='true']");
    expect(busy).toBeTruthy();
  });
});
