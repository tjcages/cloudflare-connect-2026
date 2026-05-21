import type { BuilderDocumentSnapshot } from "./documentSnapshot";
import { getBuilderDocumentSharePayload } from "./documentSnapshot";

/** Production share base — never use `window.location` when copying links. */
export const BUILDER_SHARE_BASE_URL = "https://section-grid-generator.hi-1e4.workers.dev";

export const buildBuilderShareUrl = (statePayload: string): string =>
  `${BUILDER_SHARE_BASE_URL}?state=${encodeURIComponent(statePayload)}`;

export const buildBuilderShareUrlFromSnapshot = async (snapshot: BuilderDocumentSnapshot): Promise<string> => {
  const payload = await getBuilderDocumentSharePayload(snapshot);
  return buildBuilderShareUrl(payload);
};

export const extractShareStateFromInput = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const state = url.searchParams.get("state");
    if (state) {
      return state;
    }
  } catch {
    // Not an absolute URL — fall through to raw payload.
  }

  return trimmed;
};

export const readBuilderShareStateFromLocation = (location: Pick<Location, "search">): string | null => {
  const state = new URLSearchParams(location.search).get("state");
  return state?.trim() ? state : null;
};

export const clearBuilderShareStateFromLocation = (): void => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("state")) {
    return;
  }

  url.searchParams.delete("state");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
};

export const copyBuilderShareLinkToClipboard = async (snapshot: BuilderDocumentSnapshot): Promise<boolean> => {
  const link = await buildBuilderShareUrlFromSnapshot(snapshot);

  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
};
