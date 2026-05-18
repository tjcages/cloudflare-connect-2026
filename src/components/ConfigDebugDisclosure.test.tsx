import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigDebugDisclosure } from "./ConfigDebugDisclosure";

describe("ConfigDebugDisclosure", () => {
  it("renders summary label and body", () => {
    render(
      <ConfigDebugDisclosure testId="test-debug" label="Diagnostics">
        <p>Body content</p>
      </ConfigDebugDisclosure>,
    );

    expect(screen.getByTestId("test-debug")).toBeInTheDocument();
    expect(screen.getByText("Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });
});
