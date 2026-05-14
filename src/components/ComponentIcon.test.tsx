import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComponentIcon } from "./ComponentIcon";
import { DEFAULT_ICON_ID } from "../lib/iconRegistry";

describe("ComponentIcon", () => {
  it("renders a registry-backed 24x24 svg with configurable color", () => {
    render(<ComponentIcon iconId={DEFAULT_ICON_ID} color="#123456" title="Icon preview" />);

    const icon = screen.getByRole("img", { name: "Icon preview" });
    const paths = icon.querySelectorAll("path");

    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveAttribute("width", "24");
    expect(icon).toHaveAttribute("height", "24");
    expect(paths).toHaveLength(3);
    paths.forEach((path) => {
      expect(path).toHaveAttribute("fill", "#123456");
    });
  });

  it("renders stroke-based registry icons with currentColor stroke", () => {
    render(<ComponentIcon iconId="user-outline" color="#B3B3B3" title="User icon" />);

    const icon = screen.getByRole("img", { name: "User icon" });
    const paths = icon.querySelectorAll("path");

    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveAttribute("fill", "none");
    expect(paths[0]).toHaveAttribute("stroke", "currentColor");
    expect(paths[0]).toHaveAttribute("stroke-width", "1.25");
  });
});
