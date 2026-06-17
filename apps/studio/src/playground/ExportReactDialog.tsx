import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { buildAiInstructions, buildReactExport } from "../lib/export/buildReactExport";
import { downloadReactExportZip } from "../lib/export/downloadReactExportZip";
import type { ExportConvention } from "../lib/export/resolveExportPaths";
import type { ReactExportSnapshot } from "../lib/export/playgroundSnapshot";
import { PLAYGROUND_CONTROL_CLASS, PLAYGROUND_MONO_CONTROL_CLASS, PLAYGROUND_TEXTAREA_CLASS } from "./playgroundUi";

type ExportReactDialogProps = {
  open: boolean;
  onClose: () => void;
  snapshot: ReactExportSnapshot;
};

type DialogTab = "ai" | "manual";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [feedback, setFeedback] = useState<"idle" | "ok" | "fail">("idle");

  const onCopy = async () => {
    const ok = await copyText(text);
    setFeedback(ok ? "ok" : "fail");
    window.setTimeout(() => setFeedback("idle"), ok ? 1200 : 1600);
  };

  const caption = feedback === "ok" ? "Copied" : feedback === "fail" ? "Copy failed" : label;

  return (
    <Button padding="inline" onClick={() => void onCopy()}>
      {caption}
    </Button>
  );
}

function SnippetSection({ title, copyLabel, text }: { title: string; copyLabel: string; text: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-builder-hairline pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[12px] font-normal text-builder-muted">{title}</h3>
        <CopyButton label={copyLabel} text={text} />
      </div>
      <pre className="ui-scroll-overlay m-0 max-h-28 overflow-auto rounded-md border border-builder-hairline bg-builder-hover-surface p-3 font-mono text-[11px] leading-relaxed text-builder-muted whitespace-pre-wrap">
        {text}
      </pre>
    </section>
  );
}

export function ExportReactDialog({ open, onClose, snapshot }: ExportReactDialogProps) {
  const [tab, setTab] = useState<DialogTab>("ai");
  const [targetDir, setTargetDir] = useState("src/components");
  const [convention, setConvention] = useState<ExportConvention>("folderIndex");

  const aiInstructions = useMemo(() => buildAiInstructions(snapshot), [snapshot]);

  const manualBundle = useMemo(() => {
    try {
      return buildReactExport(snapshot, { targetDir, convention });
    } catch {
      return null;
    }
  }, [snapshot, targetDir, convention]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <dialog
        open
        aria-labelledby="export-react-title"
        className="export-react-dialog flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-builder-hairline bg-white shadow-xl"
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-builder-hairline px-4 py-3">
          <div>
            <h2 id="export-react-title" className="m-0 text-[14px] font-normal text-builder-text">
              Export as React
            </h2>
            <p className="m-0 mt-1 text-[11px] leading-4 text-builder-control">
              {tab === "ai" ? (
                <>
                  AI mode auto-detects <code className="font-mono">components</code> and file naming in the target repo.
                </>
              ) : (
                <>
                  Manual mode — adjust paths below. Exports <code className="font-mono">AsciiVideo</code>.
                </>
              )}
            </p>
          </div>
          <Button padding="inline" onClick={onClose} aria-label="Close export dialog">
            Close
          </Button>
        </header>

        <div className="shrink-0 flex gap-1 border-b border-builder-hairline bg-builder-hover-surface px-4 pt-2">
          <button
            type="button"
            className={`rounded-t-md border px-3 py-1.5 text-[12px] ${
              tab === "ai"
                ? "border-builder-hairline border-b-white bg-white text-builder-muted"
                : "border-transparent text-builder-control hover:text-builder-muted"
            }`}
            onClick={() => setTab("ai")}
          >
            AI Instructions
          </button>
          <button
            type="button"
            className={`rounded-t-md border px-3 py-1.5 text-[12px] ${
              tab === "manual"
                ? "border-builder-hairline border-b-white bg-white text-builder-muted"
                : "border-transparent text-builder-control hover:text-builder-muted"
            }`}
            onClick={() => setTab("manual")}
          >
            Manual
          </button>
        </div>

        {tab === "manual" ? (
          <div className="shrink-0 border-b border-builder-hairline px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[12px] text-builder-muted">
                Target directory
                <input
                  type="text"
                  className={PLAYGROUND_MONO_CONTROL_CLASS}
                  value={targetDir}
                  onChange={(event) => setTargetDir(event.target.value)}
                  spellCheck={false}
                  placeholder="src/components"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] text-builder-muted">
                Entry file convention
                <select
                  className={PLAYGROUND_CONTROL_CLASS}
                  value={convention}
                  onChange={(event) => setConvention(event.target.value as ExportConvention)}
                >
                  <option value="folderIndex">index.tsx in folder</option>
                  <option value="namedFile">AsciiVideo.tsx</option>
                </select>
              </label>
            </div>
            {manualBundle ? (
              <p className="m-0 mt-2 font-mono text-[11px] text-builder-control">
                Resolved: <span className="text-builder-muted">{manualBundle.resolved.directory}/</span>
              </p>
            ) : (
              <p className="m-0 mt-2 text-[11px] text-red-600">Enter a target directory (e.g. src/components).</p>
            )}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "ai" ? (
            <div className="flex flex-col gap-2">
              <CopyButton label="Copy AI instructions" text={aiInstructions} />
              <pre
                className={`${PLAYGROUND_TEXTAREA_CLASS} ui-scroll-overlay m-0 min-h-[280px] overflow-auto whitespace-pre-wrap`}
              >
                {aiInstructions}
              </pre>
            </div>
          ) : manualBundle ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-builder-hairline bg-builder-hover-surface px-3 py-2 text-[11px] leading-relaxed text-builder-muted whitespace-pre-wrap">
                {manualBundle.prerequisites}
              </div>

              <section className="flex flex-col gap-2">
                <h3 className="m-0 text-[12px] font-normal text-builder-muted">Component files</h3>
                <p className="m-0 text-[11px] leading-relaxed text-builder-control">
                  Download a zip with {manualBundle.files.length} files laid out under{" "}
                  <code className="font-mono">{manualBundle.resolved.directory}/</code>. Unzip at your project root.
                </p>
                <Button
                  padding="inline"
                  className="self-start"
                  onClick={() => downloadReactExportZip(manualBundle.files, "ascii-video-export.zip")}
                >
                  Download zip
                </Button>
              </section>

              <SnippetSection title="Install" copyLabel="Copy install" text={manualBundle.installInstructions} />
              <SnippetSection title="Usage" copyLabel="Copy usage snippet" text={manualBundle.usageSnippet} />

              <section className="flex flex-col gap-2 border-t border-builder-hairline pt-3">
                <h3 className="m-0 text-[12px] font-normal text-builder-muted">Astro (optional)</h3>
                <p className="m-0 text-[11px] leading-relaxed text-builder-control whitespace-pre-wrap">
                  {manualBundle.astroUsage}
                </p>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-builder-hairline bg-builder-hover-surface px-4 py-2 text-[11px] text-builder-control">
          React must already be installed in the target project. This export only installs{" "}
          <code className="font-mono">pixi.js</code>.
        </footer>
      </dialog>
    </div>
  );
}
