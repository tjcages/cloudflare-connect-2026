/**
 * Copy a settings record to the clipboard as pretty JSON. The config is also
 * echoed to the console, which doubles as the fallback if the Clipboard API
 * is unavailable (it requires a secure context).
 */
export function copyConfigToClipboard(label: string, config: unknown): void {
  const text = JSON.stringify(config, null, 2);
  console.log(`[connect] ${label} config\n${text}`);
  void navigator.clipboard?.writeText(text).catch(() => {
    console.warn(
      `[connect] Clipboard write failed; ${label} config is logged above.`
    );
  });
}
