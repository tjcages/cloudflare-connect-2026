declare global {
  interface Window {
    schedulerYieldReady: boolean;
  }
}

export const schedulerYield = async () => {
  if (window.schedulerYieldReady) return await scheduler.yield();

  if (typeof scheduler === "undefined") await import("scheduler-polyfill");

  window.schedulerYieldReady = true;

  return await scheduler.yield();
};
