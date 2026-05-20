import { useState } from "react";
import {
  copyBuilderDocumentSnapshotToClipboard,
  getBuilderDocumentSnapshot,
  parseBuilderDocumentSnapshotInput,
} from "../lib/documentSnapshot";
import { useAppStore } from "../store";
import { BuilderField } from "./BuilderField";
import { Button } from "./Button";
import { SectionHeading } from "./SectionHeading";

type CopyFeedback = "idle" | "copied" | "failed";
type ImportFeedback = "idle" | "imported" | "failed";

export const ShareSidebar = () => {
  const [importText, setImportText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>("idle");
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>("idle");
  const applyBuilderDocumentSnapshot = useAppStore((s) => s.applyBuilderDocumentSnapshot);

  const onCopyState = async () => {
    const snapshot = getBuilderDocumentSnapshot(useAppStore.getState());
    const ok = await copyBuilderDocumentSnapshotToClipboard(snapshot);
    setCopyFeedback(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyFeedback("idle"), ok ? 1200 : 1600);
  };

  const onImportState = () => {
    const trimmed = importText.trim();
    if (!trimmed) {
      setImportFeedback("failed");
      window.setTimeout(() => setImportFeedback("idle"), 1600);
      return;
    }

    try {
      const snapshot = parseBuilderDocumentSnapshotInput(trimmed);
      applyBuilderDocumentSnapshot(snapshot);
      setImportText("");
      setImportFeedback("imported");
      window.setTimeout(() => setImportFeedback("idle"), 1200);
    } catch {
      setImportFeedback("failed");
      window.setTimeout(() => setImportFeedback("idle"), 1600);
    }
  };

  const copyLabel = copyFeedback === "copied" ? "Copied" : copyFeedback === "failed" ? "Copy failed" : "Copy state";
  const importStatus =
    importFeedback === "imported" ? "Imported" : importFeedback === "failed" ? "Import failed" : null;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <section className="flex flex-col gap-3.5 px-3.5 py-3.5">
        <SectionHeading title="Share" />
        <Button
          type="button"
          variant="default"
          padding="square"
          data-testid="share-copy-state"
          onClick={() => void onCopyState()}
        >
          {copyLabel}
        </Button>
        <BuilderField>
          <span>Import state</span>
          <textarea
            id="share-import-textarea"
            data-testid="share-import-textarea"
            className="builder-field-control min-h-[120px] resize-y font-mono text-[11px]"
            rows={8}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            spellCheck={false}
          />
        </BuilderField>
        <Button
          type="button"
          variant="default"
          padding="square"
          data-testid="share-import-state"
          onClick={onImportState}
        >
          Import
        </Button>
        {importStatus ? (
          <p className="m-0 text-[11px] text-builder-control" data-testid="share-import-status">
            {importStatus}
          </p>
        ) : null}
      </section>
    </div>
  );
};
