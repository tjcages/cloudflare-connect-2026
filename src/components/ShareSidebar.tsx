import { useState } from "react";
import { copyBuilderShareLinkToClipboard } from "../lib/builderShareLink";
import {
  copyBuilderDocumentSnapshotToClipboard,
  getBuilderDocumentSnapshot,
  parseBuilderDocumentSnapshotInput,
} from "../lib/documentSnapshot";
import { useAppStore } from "../store";
import { Button } from "./Button";
import { SectionHeading } from "./SectionHeading";

type CopyFeedback = "idle" | "copied" | "failed";
type ImportFeedback = "idle" | "imported" | "failed";

const sectionContentClass = "flex flex-col gap-3.5 px-3.5";

export const ShareSidebar = () => {
  const [importText, setImportText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>("idle");
  const [copyLinkFeedback, setCopyLinkFeedback] = useState<CopyFeedback>("idle");
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>("idle");
  const applyBuilderDocumentSnapshot = useAppStore((s) => s.applyBuilderDocumentSnapshot);

  const onCopyState = async () => {
    const snapshot = getBuilderDocumentSnapshot(useAppStore.getState());
    const ok = await copyBuilderDocumentSnapshotToClipboard(snapshot);
    setCopyFeedback(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyFeedback("idle"), ok ? 1200 : 1600);
  };

  const onCopyLink = async () => {
    const snapshot = getBuilderDocumentSnapshot(useAppStore.getState());
    const ok = await copyBuilderShareLinkToClipboard(snapshot);
    setCopyLinkFeedback(ok ? "copied" : "failed");
    window.setTimeout(() => setCopyLinkFeedback("idle"), ok ? 1200 : 1600);
  };

  const onImportState = () => {
    void (async () => {
      const trimmed = importText.trim();
      if (!trimmed) {
        setImportFeedback("failed");
        window.setTimeout(() => setImportFeedback("idle"), 1600);
        return;
      }

      try {
        const snapshot = await parseBuilderDocumentSnapshotInput(trimmed);
        applyBuilderDocumentSnapshot(snapshot);
        setImportText("");
        setImportFeedback("imported");
        window.setTimeout(() => setImportFeedback("idle"), 1200);
      } catch {
        setImportFeedback("failed");
        window.setTimeout(() => setImportFeedback("idle"), 1600);
      }
    })();
  };

  const copyLabel =
    copyFeedback === "copied" ? "Copied" : copyFeedback === "failed" ? "Copy failed" : "Copy state to clipboard";
  const copyLinkLabel =
    copyLinkFeedback === "copied" ? "Copied" : copyLinkFeedback === "failed" ? "Copy failed" : "Copy link";
  const importStatus =
    importFeedback === "imported" ? "Imported" : importFeedback === "failed" ? "Import failed" : null;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <section className="flex flex-col gap-0 py-3.5">
        <SectionHeading title="Share link" />
        <div className={sectionContentClass}>
          <Button
            type="button"
            variant="default"
            padding="square"
            data-testid="share-copy-link"
            onClick={() => void onCopyLink()}
          >
            {copyLinkLabel}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-0 border-t border-builder-hairline py-3.5">
        <SectionHeading title="Copy state" />
        <div className={sectionContentClass}>
          <Button
            type="button"
            variant="default"
            padding="square"
            data-testid="share-copy-state"
            onClick={() => void onCopyState()}
          >
            {copyLabel}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-0 border-t border-builder-hairline py-3.5">
        <SectionHeading title="Import state" />
        <div className={sectionContentClass}>
          <textarea
            id="share-import-textarea"
            data-testid="share-import-textarea"
            className="builder-field-control min-h-[120px] resize-y font-mono text-[11px]"
            rows={8}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            spellCheck={false}
          />
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
        </div>
      </section>
    </div>
  );
};
