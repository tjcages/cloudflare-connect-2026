import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComponentIcon } from "./ComponentIcon";
import { DEFAULT_ICON_ID } from "../lib/iconRegistry";

describe("ComponentIcon", () => {
  it("renders a registry-backed 24x24 svg with configurable fill paths", () => {
    const { container } = render(<ComponentIcon iconId={DEFAULT_ICON_ID} color="#123456" />);

    const icon = container.querySelector("svg.component-icon");
    const paths = icon!.querySelectorAll("path");

    expect(icon?.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("width", "24");
    expect(icon).toHaveAttribute("height", "24");
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => {
      expect(path).toHaveAttribute("fill", "#123456");
    });
  });

  it("renders stroke-based registry icons with currentColor stroke", () => {
    const { container } = render(<ComponentIcon iconId="user-outline" color="#B3B3B3" />);

    const icon = container.querySelector("svg.component-icon");
    const paths = icon!.querySelectorAll("path");

    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => {
      expect(path).toHaveAttribute("fill", "none");
      expect(path).toHaveAttribute("stroke", "currentColor");
    });
    expect(paths[0]).toHaveAttribute("stroke-width", "1.25");
  });
});
