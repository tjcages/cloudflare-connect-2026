import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { copyDocumentPng, createDocumentPngBlob } from "./pngExport";

function patchNavigatorClipboard(next: Clipboard | undefined): () => void {
  const prev = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    value: next,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  return () => {
    if (prev) {
      Object.defineProperty(navigator, "clipboard", prev);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  };
}

describe("pngExport", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
    vi.restoreAllMocks();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when Pixi application is unavailable", async () => {
    useAppStore.setState({ pixiApp: null });

    await expect(createDocumentPngBlob()).rejects.toThrow(/Pixi application is unavailable/i);
  });

  it("clears selection, renders the stage, extracts at 2x resolution, and returns a PNG blob", async () => {
    const extractImage = vi.fn().mockResolvedValue({ width: 40, height: 24 });
    const renderFn = vi.fn();
    const mockApp = {
      stage: {},
      renderer: {
        render: renderFn,
        extract: { image: extractImage },
      },
    };

    useAppStore.setState({
      selectedInstanceId: "icon-box-1",
      pixiApp: mockApp as never,
    });

    const blob = await createDocumentPngBlob();

    expect(useAppStore.getState().selectedInstanceId).toBeNull();
    expect(renderFn).toHaveBeenCalledWith(mockApp.stage);
    expect(extractImage).toHaveBeenCalledWith({
      target: mockApp.stage,
      format: "png",
      resolution: 2,
      antialias: true,
      clearColor: "#00000000",
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
  });

  it("writes PNG to the clipboard when navigator.clipboard.write and ClipboardItem exist", async () => {
    const extractImage = vi.fn().mockResolvedValue({ width: 8, height: 8 });
    const mockApp = {
      stage: {},
      renderer: {
        render: vi.fn(),
        extract: { image: extractImage },
      },
    };

    useAppStore.setState({ pixiApp: mockApp as never });

    const write = vi.fn().mockResolvedValue(undefined);
    const restoreClipboard = patchNavigatorClipboard({ write } as unknown as Clipboard);

    class ClipboardItemStub {
      static items: ClipboardItemStub[] = [];

      constructor(public readonly payload: Record<string, Blob>) {
        ClipboardItemStub.items.push(this);
      }
    }

    vi.stubGlobal("ClipboardItem", ClipboardItemStub);

    try {
      await copyDocumentPng();

      expect(write).toHaveBeenCalledTimes(1);
      const payload = write.mock.calls[0][0] as ClipboardItemStub[];
      expect(payload[0]).toBeInstanceOf(ClipboardItemStub);
    } finally {
      restoreClipboard();
    }
  });

  it("downloads PNG when rich clipboard APIs are unavailable", async () => {
    const extractImage = vi.fn().mockResolvedValue({ width: 8, height: 8 });
    const mockApp = {
      stage: {},
      renderer: {
        render: vi.fn(),
        extract: { image: extractImage },
      },
    };

    useAppStore.setState({ pixiApp: mockApp as never });

    const restoreClipboard = patchNavigatorClipboard(undefined);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    try {
      await copyDocumentPng();

      expect(clickSpy).toHaveBeenCalled();
      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    } finally {
      restoreClipboard();
    }
  });
});
