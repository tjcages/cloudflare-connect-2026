type SvgClipboard = {
  write?: (data: ClipboardItem[]) => Promise<void>;
  writeText: (data: string) => Promise<void>;
};

type ClipboardItemConstructor = {
  new (items: Record<string, Blob>): ClipboardItem;
  supports?: (type: string) => boolean;
};

const SVG_MIME_TYPE = "image/svg+xml";

export const writeSvgToClipboard = async (
  svg: string,
  clipboard: SvgClipboard = navigator.clipboard,
  ClipboardItemCtor: ClipboardItemConstructor | undefined = globalThis.ClipboardItem,
) => {
  if (ClipboardItemCtor && clipboard.write) {
    const items: Record<string, Blob> = {};

    if (!ClipboardItemCtor.supports || ClipboardItemCtor.supports(SVG_MIME_TYPE)) {
      items[SVG_MIME_TYPE] = new Blob([svg], { type: SVG_MIME_TYPE });
    }

    items["text/html"] = new Blob([svg], { type: "text/html" });
    items["text/plain"] = new Blob([svg], { type: "text/plain" });

    try {
      await clipboard.write([new ClipboardItemCtor(items)]);
      return;
    } catch {
      // Keep copy working in browsers that expose rich clipboard APIs but reject SVG payloads.
    }
  }

  await clipboard.writeText(svg);
};
