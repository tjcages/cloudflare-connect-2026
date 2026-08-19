import {
  ControlAction,
  ControlDisclosure,
  type RenderFieldContext,
} from "@tjcages/panels/dev";
import { useEffect, useRef, useState } from "react";
import { copyConfigToClipboard } from "./copyConfig";
import type { PanelCustomField, PanelValues } from "./panelSections";
import "./configTools.css";

/**
 * Config-section tools shared by every shader target: a Copy / Paste / Reset
 * action row plus a collapsible JSON view of the live config with an editable
 * textarea and Apply. Paste and Apply merge only the target's known keys (the
 * authored default record's keys) into the current config and push the result
 * through the target's own change path, so an imported config persists and
 * publishes exactly like a slider drag.
 */
export type ConfigToolsTarget<S extends object> = {
  /** Console label — the same one the copy action always logged. */
  label: string;
  /** Authored defaults; their keys are the known-key set for paste/apply. */
  defaults: S;
  /** Persisted blobs (`panels:${id}`) cleared on reset. */
  storageIds: string[];
  /** Panel values → the settings record persisted, published and copied. */
  toConfig: (values: PanelValues) => S;
  /** Settings record → panel values (the target's seed function). */
  seed: (config: S) => PanelValues;
};

/** The Config section's field — one builder consumed by every shader target. */
export function configToolsField<S extends object>(
  target: ConfigToolsTarget<S>
): PanelCustomField {
  return {
    type: "site-custom",
    key: "configTools",
    // Keyed by target so drafts and status never leak across targets.
    render: (ctx) => (
      <ConfigTools ctx={ctx} key={target.label} target={target} />
    ),
  };
}

const STATUS_MS = 2500;

function ConfigTools<S extends object>({
  ctx,
  target,
}: {
  ctx: RenderFieldContext;
  target: ConfigToolsTarget<S>;
}) {
  const [status, setStatus] = useState<{ id: number; text: string } | null>(
    null
  );
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  /** Textarea override while focused/dirty; null = mirror the live config. */
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => () => clearTimeout(statusTimer.current), []);

  const showStatus = (text: string) => {
    clearTimeout(statusTimer.current);
    setStatus({ id: Date.now(), text });
    statusTimer.current = setTimeout(() => setStatus(null), STATUS_MS);
  };

  const currentJson = JSON.stringify(target.toConfig(ctx.values), null, 2);

  const applyConfig = (text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      showStatus("Invalid JSON");
      return;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      showStatus("Invalid JSON");
      return;
    }
    const entries = Object.entries(parsed);
    const known = entries.filter(([key]) => key in target.defaults);
    const merged = {
      ...target.toConfig(ctx.values),
      ...Object.fromEntries(known),
    } as S;
    ctx.setValues(target.seed(merged));
    setDraft(null);
    const ignored = entries.length - known.length;
    showStatus(
      ignored > 0
        ? `Applied ${known.length} keys · ${ignored} ignored`
        : `Applied ${known.length} keys`
    );
  };

  const pasteConfig = () => {
    if (!navigator.clipboard?.readText) {
      showStatus("Clipboard unavailable");
      return;
    }
    navigator.clipboard.readText().then(applyConfig, () => {
      showStatus("Clipboard unavailable");
    });
  };

  const resetConfig = () => {
    // Publish + persist the authored defaults through the normal change
    // path, then drop the persisted blobs so a reload seeds from source.
    ctx.setValues(target.seed(target.defaults));
    setDraft(null);
    for (const id of target.storageIds) {
      try {
        localStorage.removeItem(`panels:${id}`);
      } catch {
        // Private-mode failures must not break the panel.
      }
    }
    showStatus("Reset to defaults");
  };

  return (
    <div className="connect-config-tools">
      <div className="connect-config-tools__row">
        <ControlAction
          label="Copy config"
          onClick={() =>
            copyConfigToClipboard(target.label, target.toConfig(ctx.values))
          }
        />
        <ControlAction label="Paste config" onClick={pasteConfig} />
        <ControlAction label="Reset" onClick={resetConfig} />
      </div>
      <ControlDisclosure title="JSON">
        <div className="connect-config-tools__json">
          <textarea
            aria-label="Current config JSON"
            onBlur={() =>
              setDraft((prev) => (prev === currentJson ? null : prev))
            }
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => setDraft((prev) => prev ?? currentJson)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setDraft(null);
                event.currentTarget.blur();
              }
            }}
            spellCheck={false}
            value={draft ?? currentJson}
          />
          <div className="connect-config-tools__apply">
            <ControlAction
              label="Apply"
              onClick={() => applyConfig(draft ?? currentJson)}
            />
          </div>
        </div>
      </ControlDisclosure>
      {status ? (
        <p className="connect-config-tools__status" key={status.id}>
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
