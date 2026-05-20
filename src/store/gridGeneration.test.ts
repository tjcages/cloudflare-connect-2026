import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "../grid/config";
import { generateGrid } from "../grid/generator";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { resetGridGenerationSchedulerForTests, scheduleGridFromConfig } from "./gridGeneration";

describe("scheduleGridFromConfig", () => {
  afterEach(() => {
    resetGridGenerationSchedulerForTests();
    resetAppStoreDocumentToDefault();
    vi.useRealTimers();
  });

  it("applies only the latest completed generation when updates are scheduled in quick succession", async () => {
    vi.useFakeTimers();

    const firstConfig = { ...DEFAULT_CONFIG, seed: "schedule-first" };
    const secondConfig = { ...DEFAULT_CONFIG, seed: "schedule-second" };
    const firstGrid = generateGrid(firstConfig);
    const secondGrid = generateGrid(secondConfig);

    let latestGrid = firstGrid;

    scheduleGridFromConfig(firstConfig, {
      onComplete: (grid) => {
        latestGrid = grid;
      },
    });
    scheduleGridFromConfig(secondConfig, {
      onComplete: (grid) => {
        latestGrid = grid;
      },
    });

    await vi.runAllTimersAsync();

    expect(latestGrid).toEqual(secondGrid);
    expect(latestGrid).not.toEqual(firstGrid);
  });

  it("updates the store when wired through grid schedule handlers", async () => {
    vi.useFakeTimers();

    const nextConfig = { ...useAppStore.getState().gridConfig, seed: "store-schedule-test" };
    const expectedGrid = generateGrid(nextConfig);

    useAppStore.getState().updateGridConfig({ seed: "store-schedule-test" });

    await vi.runAllTimersAsync();

    expect(useAppStore.getState().grid).toEqual(expectedGrid);
    expect(useAppStore.getState().gridGenerationPending).toBe(false);
  });
});
