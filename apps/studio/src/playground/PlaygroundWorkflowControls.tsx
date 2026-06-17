import { LevaPanel, useCreateStore } from "leva";
import { PLAYGROUND_LEVA_LIGHT_THEME } from "./playgroundLevaTheme";

type PlaygroundWorkflowControlsProps = {
  workflowStore: ReturnType<typeof useCreateStore>;
  onUploadClick: () => void;
  onCopyState: () => void;
  onImportState: () => void;
  uploadError?: string | null;
  importStatus?: string | null;
  loadError?: string | null;
  fallbackTextureAvailable?: boolean;
  onLoadFallbackTexture?: () => void;
  disabled?: boolean;
};

export function PlaygroundWorkflowControls({
  workflowStore,
  onUploadClick,
  onCopyState,
  onImportState,
  uploadError,
  importStatus,
  loadError,
  fallbackTextureAvailable = false,
  onLoadFallbackTexture,
  disabled = false,
}: PlaygroundWorkflowControlsProps) {
  const showLoadError = Boolean(loadError);
  const showUploadError = Boolean(uploadError);
  const showImportStatus = Boolean(importStatus);

  return (
    <section className="playground-workflow-controls" data-testid="playground-workflow-controls">
      {showLoadError ? (
        <>
          <p className="playground-workflow-status">{loadError}</p>
          {fallbackTextureAvailable ? (
            <button type="button" disabled={disabled} onClick={() => onLoadFallbackTexture?.()}>
              Load fallback texture
            </button>
          ) : null}
        </>
      ) : null}

      <button type="button" disabled={disabled} onClick={onUploadClick}>
        Upload texture
      </button>
      {showUploadError ? <p className="playground-workflow-status">{uploadError}</p> : null}

      <button type="button" disabled={disabled} onClick={() => void onCopyState()}>
        Copy state
      </button>

      <div data-testid="playground-workflow-import-panel" className="playground-workflow-leva-panel shrink-0">
        <LevaPanel store={workflowStore} theme={PLAYGROUND_LEVA_LIGHT_THEME} fill flat titleBar={false} />
      </div>

      <button type="button" disabled={disabled} onClick={onImportState}>
        Import state
      </button>
      {showImportStatus ? <p className="playground-workflow-status">{importStatus}</p> : null}
    </section>
  );
}
