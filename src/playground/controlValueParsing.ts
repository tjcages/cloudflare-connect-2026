export function clampControlValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

/** Partial drafts like "", "-", "." return null (no numeric value yet). */
export function parseControlValueDraft(draft: string): number | null {
  const trimmed = draft.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function isControlValueDraftInRange(draft: string, min: number, max: number): boolean {
  const parsed = parseControlValueDraft(draft);
  if (parsed === null) {
    return false;
  }
  return parsed >= min && parsed <= max;
}

export function resolveControlValueOnBlur(draft: string, committed: number, min: number, max: number): number {
  const parsed = parseControlValueDraft(draft);
  if (parsed === null) {
    return committed;
  }
  return clampControlValue(parsed, min, max);
}
