import { useMemo, useState } from "react";
import { buildAiInstructions, buildReactExport } from "../lib/export/buildReactExport";
import { downloadReactExportZip } from "../lib/export/downloadReactExportZip";
import type { ExportConvention } from "../lib/export/resolveExportPaths";
import type { ReactExportSnapshot } from "../lib/export/playgroundSnapshot";

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
    <button
      type="button"
      className="shrink-0 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
      onClick={() => void onCopy()}
    >
      {caption}
    </button>
  );
}

function SnippetSection({ title, copyLabel, text }: { title: string; copyLabel: string; text: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-xs font-medium text-neutral-700">{title}</h3>
        <CopyButton label={copyLabel} text={text} />
      </div>
      <pre className="ui-scroll-overlay m-0 max-h-28 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
        className="export-react-dialog flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3">
          <div>
            <h2 id="export-react-title" className="m-0 text-base font-semibold text-neutral-900">
              Export as React
            </h2>
            <p className="m-0 mt-1 text-xs text-neutral-500">
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
          <button
            type="button"
            className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            Close
          </button>
        </header>

        <div className="shrink-0 flex gap-1 border-b border-neutral-200 px-4 pt-2">
          <button
            type="button"
            className={`rounded-t border px-3 py-1.5 text-sm ${
              tab === "ai" ? "border-neutral-300 border-b-white bg-white" : "border-transparent text-neutral-500"
            }`}
            onClick={() => setTab("ai")}
          >
            AI Instructions
          </button>
          <button
            type="button"
            className={`rounded-t border px-3 py-1.5 text-sm ${
              tab === "manual" ? "border-neutral-300 border-b-white bg-white" : "border-transparent text-neutral-500"
            }`}
            onClick={() => setTab("manual")}
          >
            Manual
          </button>
        </div>

        {tab === "manual" ? (
          <div className="shrink-0 border-b border-neutral-200 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-neutral-600">
                Target directory
                <input
                  type="text"
                  className="rounded border border-neutral-300 px-2 py-1.5 font-mono text-sm text-neutral-900"
                  value={targetDir}
                  onChange={(event) => setTargetDir(event.target.value)}
                  spellCheck={false}
                  placeholder="src/components"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-neutral-600">
                Entry file convention
                <select
                  className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                  value={convention}
                  onChange={(event) => setConvention(event.target.value as ExportConvention)}
                >
                  <option value="folderIndex">index.tsx in folder</option>
                  <option value="namedFile">AsciiVideo.tsx</option>
                </select>
              </label>
            </div>
            {manualBundle ? (
              <p className="m-0 mt-2 font-mono text-xs text-neutral-500">
                Resolved: <span className="text-neutral-800">{manualBundle.resolved.directory}/</span>
              </p>
            ) : (
              <p className="m-0 mt-2 text-xs text-red-600">Enter a target directory (e.g. src/components).</p>
            )}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "ai" ? (
            <div className="flex flex-col gap-2">
              <CopyButton label="Copy AI instructions" text={aiInstructions} />
              <pre className="ui-scroll-overlay m-0 min-h-[280px] overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {aiInstructions}
              </pre>
            </div>
          ) : manualBundle ? (
            <div className="flex flex-col gap-4">
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 whitespace-pre-wrap">
                {manualBundle.prerequisites}
              </div>

              <section className="flex flex-col gap-2">
                <h3 className="m-0 text-xs font-medium text-neutral-700">Component files</h3>
                <p className="m-0 text-xs leading-relaxed text-neutral-600">
                  Download a zip with {manualBundle.files.length} files laid out under{" "}
                  <code className="font-mono">{manualBundle.resolved.directory}/</code>. Unzip at your project root.
                </p>
                <button
                  type="button"
                  className="self-start rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800"
                  onClick={() => downloadReactExportZip(manualBundle.files, "ascii-video-export.zip")}
                >
                  Download zip
                </button>
              </section>

              <SnippetSection title="Install" copyLabel="Copy install" text={manualBundle.installInstructions} />
              <SnippetSection title="Usage" copyLabel="Copy usage snippet" text={manualBundle.usageSnippet} />

              <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
                <h3 className="m-0 text-xs font-medium text-neutral-700">Astro (optional)</h3>
                <p className="m-0 text-xs leading-relaxed text-neutral-600 whitespace-pre-wrap">
                  {manualBundle.astroUsage}
                </p>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
          React must already be installed in the target project. This export only installs{" "}
          <code className="font-mono">pixi.js</code>.
        </footer>
      </dialog>
    </div>
  );
}
