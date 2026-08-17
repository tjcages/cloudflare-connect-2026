import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectTwizzler } from "./ConnectTwizzler";

describe("<ConnectTwizzler>", () => {
  it("server-renders a stable poster beneath its decorative canvas", () => {
    const { container } = render(<ConnectTwizzler className="hero" canvasClassName="ink" posterSrc="/twizzler.png" />);
    expect(container.querySelector(".hero")).not.toBeNull();
    expect(container.querySelector('img[src="/twizzler.png"]')).not.toBeNull();
    expect(container.querySelector("canvas.ink")?.getAttribute("aria-hidden")).toBeNull();
  });
});
