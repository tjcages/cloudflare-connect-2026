const STORAGE_KEY = "section-grid-builder";

export type SectionGridBuilderDevApi = {
  getPersistRaw: () => string | null;
  getPersistState: () => unknown;
};

function parseEnvelope(raw: string | null): unknown {
  if (raw === null || raw === "") {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function exposeSectionGridBuilderDevApi(): SectionGridBuilderDevApi {
  return {
    getPersistRaw: () => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
    getPersistState: () => {
      const envelope = parseEnvelope(
        (() => {
          try {
            return localStorage.getItem(STORAGE_KEY);
          } catch {
            return null;
          }
        })(),
      );
      if (envelope === null || typeof envelope !== "object" || envelope === null || !("state" in envelope)) {
        return null;
      }
      return (envelope as { state: unknown }).state;
    },
  };
}
