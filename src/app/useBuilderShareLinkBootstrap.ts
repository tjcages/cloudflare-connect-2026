import { useEffect } from "react";
import { clearBuilderShareStateFromLocation, readBuilderShareStateFromLocation } from "../lib/builderShareLink";
import { parseBuilderDocumentSnapshotInput } from "../lib/documentSnapshot";
import { useAppStore } from "../store";

export const useBuilderShareLinkBootstrap = (): void => {
  useEffect(() => {
    const stateParam = readBuilderShareStateFromLocation(window.location);
    if (!stateParam) {
      return undefined;
    }

    let cancelled = false;

    const applySharedState = async () => {
      try {
        const snapshot = await parseBuilderDocumentSnapshotInput(stateParam);
        if (cancelled) {
          return;
        }

        useAppStore.getState().applyBuilderDocumentSnapshot(snapshot);
        clearBuilderShareStateFromLocation();
      } catch {
        // Ignore invalid share payloads so local persistence still loads.
      }
    };

    const runAfterHydration = () => {
      void applySharedState();
    };

    if (useAppStore.persist.hasHydrated()) {
      runAfterHydration();
    } else {
      const unsubHydration = useAppStore.persist.onFinishHydration(runAfterHydration);
      return () => {
        cancelled = true;
        unsubHydration();
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);
};
