import { button, folder } from "leva";

/**
 * Copy a settings record to the clipboard as pretty JSON. The config is also
 * echoed to the console, which doubles as the fallback if the Clipboard API
 * is unavailable (it requires a secure context).
 */
export function copyConfigToClipboard(label: string, config: unknown): void {
  const text = JSON.stringify(config, null, 2);
  console.log(`[connect] ${label} config\n${text}`);
  void navigator.clipboard?.writeText(text).catch(() => {
    console.warn(`[connect] Clipboard write failed; ${label} config is logged above.`);
  });
}

/**
 * The panel's closing section: every shader target ends with a Config folder
 * whose Copy config button snapshots the target's current settings, so an
 * authored look can always be lifted out of localStorage and baked into
 * production defaults.
 */
export const copyConfigFolder = (onCopyConfig: () => void) =>
  folder({ "Copy config": button(onCopyConfig) }, { collapsed: false });
