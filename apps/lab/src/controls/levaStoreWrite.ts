/**
 * Safe programmatic Leva writes.
 *
 * Leva's `set` throws if any key is missing from mappedPaths (all-or-nothing),
 * always notifies subscribers (even `set({})`), and sanitize can echo a new
 * value back. Rapid slider/color updates plus effects that write into the same
 * store is how React #185 shows up when "any value changes too fast" (CF-68).
 */

export function levaValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left === "string" && typeof right === "string") {
    const a = left.trim();
    const b = right.trim();
    if (a === b) return true;
    if (isHexString(a) && isHexString(b))
      return a.replace(/^#/, "").toLowerCase() === b.replace(/^#/, "").toLowerCase();
    return false;
  }
  if (typeof left === "number" && typeof right === "number") return left === right;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return left === right;
  if (typeof left !== "object") return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function isHexString(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value);
}

export function diffLevaPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!levaValuesEqual(current[key], value)) next[key] = value;
  }
  return next;
}

export function applyLevaPatch(
  setter: ((patch: Record<string, unknown>) => void) | null | undefined,
  patch: Record<string, unknown>,
): void {
  if (!setter || Object.keys(patch).length === 0) return;
  try {
    setter(patch);
  } catch {
    for (const [key, value] of Object.entries(patch)) {
      try {
        setter({ [key]: value });
      } catch {
        /* key lives on the other Leva store */
      }
    }
  }
}

export type LevaPatchWriter = {
  write: (patch: Record<string, unknown>) => void;
  writeNow: (patch: Record<string, unknown>) => void;
  dispose: () => void;
};

export function createLevaPatchWriter(options: {
  getSetter: () => ((patch: Record<string, unknown>) => void) | null | undefined;
  getCurrent: () => Record<string, unknown>;
}): LevaPatchWriter {
  let pending: Record<string, unknown> | null = null;
  let raf = 0;

  const flush = () => {
    raf = 0;
    const patch = pending;
    pending = null;
    if (!patch) return;
    applyLevaPatch(options.getSetter(), diffLevaPatch(options.getCurrent(), patch));
  };

  const schedule =
    typeof requestAnimationFrame === "function"
      ? (cb: () => void) => requestAnimationFrame(cb)
      : (cb: () => void) => setTimeout(cb, 0);

  const cancel =
    typeof cancelAnimationFrame === "function"
      ? (id: number) => cancelAnimationFrame(id)
      : (id: number) => clearTimeout(id);

  return {
    write(patch: Record<string, unknown>) {
      if (Object.keys(patch).length === 0) return;
      pending = { ...pending, ...patch };
      if (raf) return;
      raf = schedule(flush) as number;
    },
    writeNow(patch: Record<string, unknown>) {
      if (Object.keys(patch).length === 0) return;
      pending = { ...pending, ...patch };
      if (raf) {
        cancel(raf);
        raf = 0;
      }
      flush();
    },
    dispose() {
      if (raf) cancel(raf);
      raf = 0;
      pending = null;
    },
  };
}
