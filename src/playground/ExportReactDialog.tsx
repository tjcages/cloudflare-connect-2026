import { useCallback, useMemo, useState } from "react";
import { buildAiInstructions, buildReactExport, type ExportFile } from "../lib/export/buildReactExport";
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
      className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
      onClick={() => void onCopy()}
    >
      {caption}
    </button>
  );
}

function FilePanel({
  files,
  activePath,
  onSelect,
}: {
  files: ExportFile[];
  activePath: string;
  onSelect: (path: string) => void;
}) {
  const active = files.find((file) => file.relativePath === activePath) ?? files[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <button
            key={file.relativePath}
            type="button"
            className={`rounded border px-2 py-1 font-mono text-xs ${
              file.relativePath === active?.relativePath
                ? "border-neutral-800 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
            onClick={() => onSelect(file.relativePath)}
          >
            {file.relativePath.split("/").pop()}
          </button>
        ))}
      </div>
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <CopyButton label={`Copy ${active.relativePath.split("/").pop()}`} text={active.content} />
          <pre className="ui-scroll-overlay m-0 min-h-[200px] flex-1 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed">
            {active.content}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function ExportReactDialog({ open, onClose, snapshot }: ExportReactDialogProps) {
  const [tab, setTab] = useState<DialogTab>("ai");
  const [targetDir, setTargetDir] = useState("src/components");
  const [convention, setConvention] = useState<ExportConvention>("folderIndex");
  const [activeFile, setActiveFile] = useState("");

  const aiInstructions = useMemo(() => buildAiInstructions(snapshot), [snapshot]);

  const manualBundle = useMemo(() => {
    try {
      return buildReactExport(snapshot, { targetDir, convention });
    } catch {
      return null;
    }
  }, [snapshot, targetDir, convention]);

  const manualAllFiles = useMemo(
    () =>
      manualBundle ? manualBundle.files.map((file) => `// ${file.relativePath}\n${file.content}`).join("\n\n") : "",
    [manualBundle],
  );

  const onCopyAllFiles = useCallback(async () => {
    if (!manualAllFiles) {
      return;
    }
    await copyText(manualAllFiles);
  }, [manualAllFiles]);

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
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-3">
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
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close export dialog"
          >
            Close
          </button>
        </header>

        {tab === "manual" ? (
          <div className="border-b border-neutral-200 px-4 py-3">
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
            <label className="mt-2 flex flex-col gap-1 text-xs text-neutral-600">
              Entry file convention
              <select
                className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                value={convention}
                onChange={(event) => setConvention(event.target.value as ExportConvention)}
              >
                <option value="folderIndex">index.tsx in folder</option>
                <option value="namedFile">AsciiVideo.tsx</option>
              </select>
            </label>
            {manualBundle ? (
              <p className="m-0 mt-2 font-mono text-xs text-neutral-500">
                Resolved: <span className="text-neutral-800">{manualBundle.resolved.directory}/</span>
              </p>
            ) : (
              <p className="m-0 mt-2 text-xs text-red-600">Enter a target directory (e.g. src/components).</p>
            )}
          </div>
        ) : null}

        <div className="flex gap-1 border-b border-neutral-200 px-4 pt-2">
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
          {tab === "ai" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <CopyButton label="Copy AI instructions" text={aiInstructions} />
              <pre className="ui-scroll-overlay m-0 min-h-[280px] flex-1 overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {aiInstructions}
              </pre>
            </div>
          ) : manualBundle ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
              <section className="text-xs text-neutral-600 whitespace-pre-wrap">{manualBundle.prerequisites}</section>
              <FilePanel
                files={manualBundle.files}
                activePath={activeFile || manualBundle.files[0]?.relativePath || ""}
                onSelect={setActiveFile}
              />
              <section className="flex flex-col gap-2">
                <CopyButton label="Copy install" text={manualBundle.installInstructions} />
                <pre className="m-0 rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] whitespace-pre-wrap">
                  {manualBundle.installInstructions}
                </pre>
              </section>
              <section className="flex flex-col gap-2">
                <CopyButton label="Copy usage snippet" text={manualBundle.usageSnippet} />
                <pre className="m-0 rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] whitespace-pre-wrap">
                  {manualBundle.usageSnippet}
                </pre>
              </section>
              <section className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
                <CopyButton label="Copy Astro instructions" text={manualBundle.astroUsage} />
                <pre className="m-0 rounded border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] whitespace-pre-wrap">
                  {manualBundle.astroUsage}
                </pre>
              </section>
              <button
                type="button"
                className="self-start rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
                onClick={() => void onCopyAllFiles()}
              >
                Copy all files
              </button>
            </div>
          ) : null}
        </div>

        <footer className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
          React must already be installed in the target project. This export only installs{" "}
          <code className="font-mono">pixi.js</code>.
        </footer>
      </dialog>
    </div>
  );
}
