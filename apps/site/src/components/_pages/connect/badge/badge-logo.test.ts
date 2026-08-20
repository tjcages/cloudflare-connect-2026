import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BADGE_MARK_RASTER,
  BADGE_PLATE_LIGHT_DEFAULT,
  BADGE_PLATE_VIEW_H,
  BADGE_PLATE_VIEW_W,
  BADGE_PRINT_FIELD_SRC,
  LOGO_FILE_ACCEPT,
  LOGO_FILE_ERROR,
  PNG_MAX_BYTES,
  SVG_MAX_BYTES,
  badgeLogoPreviewSrc,
  badgeMarkSvg,
  badgePlateLitStops,
  badgePlateLogoRect,
  badgeShaderPlateRaster,
  badgeShaderPlateSvg,
  extractSvgInner,
  paintSvgFills,
  paintSvgFillsWhite,
  parseJpegSize,
  parsePngSize,
  parseSvgViewport,
  parseWebpSize,
  prepareBadgeLogo,
  readLogoFile,
  readSvgFile,
  stripUnsafeSvg,
  svgRasterSize,
} from "./badge-logo";

describe("badge logo SVG prep", () => {
  it("strips scripts, foreignObject, and on* handlers", () => {
    const raw = `<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><foreignObject></foreignObject><path onclick="boom()" d="M0 0"/></svg>`;
    const safe = stripUnsafeSvg(raw);
    expect(safe).not.toMatch(/script/i);
    expect(safe).not.toMatch(/foreignObject/i);
    expect(safe).not.toMatch(/onload|onclick/i);
    expect(safe).toContain("<path");
  });

  it("reads viewBox and inner markup", () => {
    const svg = `<svg viewBox="0 0 20 10"><circle cx="10" cy="5" r="4"/></svg>`;
    expect(parseSvgViewport(svg)).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    expect(extractSvgInner(svg)).toBe(`<circle cx="10" cy="5" r="4"/>`);
  });

  it("paints fills white and builds a full stylized SVG plate from the upload", () => {
    const prepared = prepareBadgeLogo(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`
    );
    expect(prepared.colorSvg).toContain("#123456");
    expect(prepared.colorSvg).toContain('width="40"');
    expect(prepared.colorSvg).toContain('height="20"');
    expect(prepared.markSvg).toContain('fill="white"');
    expect(prepared.markSvg).not.toContain("#123456");
    const plate = badgeShaderPlateSvg(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`
    );
    expect(plate).toContain("M0 0h40v20z");
    expect(plate).toContain('width="1600"');
    expect(plate).toContain('height="1200"');
    expect(plate).toContain('viewBox="0 0 800 600"');
    expect(plate).toContain('viewBox="0 0 40 20"');
    expect(plate).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(plate).toContain('fill="#000000"');
    expect(plate).toContain('stroke="#ffffff"');
    expect(plate).toContain("url(#badge-print-lit)");
    expect(plate).not.toContain("#123456");
    expect(plate).not.toContain("#1f1f1f");
    expect(plate).not.toContain("#5a5a5a");
    const lit = badgePlateLitStops(BADGE_PLATE_LIGHT_DEFAULT);
    expect(plate).toContain(`stop-color="${lit.hi}"`);
    expect(plate).toContain(`stop-color="${lit.lo}"`);
    expect(Number.parseInt(lit.lo.slice(1, 3), 16)).toBeLessThan(0x1f);
    const previous = badgePlateLitStops(1);
    expect(previous).toEqual({
      hi: "#b4b4b4",
      mid: "#5a5a5a",
      lo: "#1f1f1f",
    });
    const dark = badgePlateLitStops(0);
    const bright = badgePlateLitStops(1);
    expect(Number.parseInt(bright.lo.slice(1, 3), 16)).toBeGreaterThan(
      Number.parseInt(dark.lo.slice(1, 3), 16)
    );
    expect(paintSvgFillsWhite(`fill="#abc" stroke="#def"`)).toBe(
      `fill="white" stroke="white"`
    );
    expect(
      paintSvgFills(
        `fill="#5865F2" style="fill:#5865F2;fill:color(display-p3 0.3451 0.3961 0.9490);"`,
        "#f46021"
      )
    ).toContain("#f46021");
    expect(
      paintSvgFills(
        `fill="#5865F2" style="fill:#5865F2;fill:color(display-p3 0.3451 0.3961 0.9490);"`,
        "#f46021"
      )
    ).not.toContain("#5865F2");
    expect(paintSvgFillsWhite(`fill="currentColor"`)).toBe(`fill="white"`);
  });

  it("centers a landscape logo large in the 4:3 plate", () => {
    expect(BADGE_PLATE_VIEW_W / BADGE_PLATE_VIEW_H).toBeCloseTo(4 / 3, 5);
    const slot = badgePlateLogoRect({ w: 40, h: 20 });
    expect(slot.w).toBeGreaterThan(BADGE_PLATE_VIEW_W * 0.8);
    expect(slot.x + slot.w / 2).toBeCloseTo(BADGE_PLATE_VIEW_W / 2, 5);
    expect(slot.y + slot.h / 2).toBeCloseTo(BADGE_PLATE_VIEW_H / 2, 5);
  });

  it("tints a mark to the theme fill", () => {
    const mark = badgeMarkSvg(
      `<svg viewBox="0 0 40 20"><path fill="#123456" d="M0 0h40v20z"/></svg>`,
      "#2563fe"
    );
    expect(mark).toContain("#2563fe");
    expect(mark).not.toContain("#123456");
    expect(mark).toContain('width="2048"');
    expect(mark).toContain('height="1024"');
    expect(mark).toContain('viewBox="0 0 40 20"');
  });

  it("rejects non-svg markup", () => {
    expect(() => prepareBadgeLogo("<div>nope</div>")).toThrow(/SVG/i);
  });

  it("rejects non-svg files and oversized uploads", async () => {
    await expect(
      readSvgFile(new File(["<svg></svg>"], "logo.png", { type: "image/png" }))
    ).rejects.toThrow(/SVG, PNG, JPEG, or WebP/i);
    await expect(
      readSvgFile(
        new File([new Uint8Array(SVG_MAX_BYTES + 1)], "logo.svg", {
          type: "image/svg+xml",
        })
      )
    ).rejects.toThrow(/400/);
    await expect(
      readSvgFile(
        new File(["<svg></svg>"], "logo.svg", {
          type: "image/svg+xml",
        })
      )
    ).resolves.toContain("<svg");
  });

  it("reads a PNG and builds a dimmed landscape plate from it", async () => {
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      ),
      (char) => char.charCodeAt(0)
    );
    expect(parsePngSize(png)).toEqual({ w: 1, h: 1 });
    const file = new File([png], "mark.png", { type: "image/png" });
    const logo = await readLogoFile(file);
    expect(logo.kind).toBe("raster");
    if (logo.kind !== "raster") return;
    expect(logo.width).toBe(1);
    expect(logo.height).toBe(1);
    expect(logo.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const plate = badgeShaderPlateRaster(logo.dataUrl, {
      w: logo.width,
      h: logo.height,
    });
    expect(plate).toContain('viewBox="0 0 800 600"');
    expect(plate).toContain("<image href=");
    expect(plate).toContain("badge-print-dim");
    expect(plate).toContain('fill="#000000"');
    await expect(
      readLogoFile(
        new File([new Uint8Array(PNG_MAX_BYTES + 1)], "huge.png", {
          type: "image/png",
        })
      )
    ).rejects.toThrow(/2 MB/);
    await expect(
      readLogoFile(new File(["nope"], "logo.gif", { type: "image/gif" }))
    ).rejects.toThrow(LOGO_FILE_ERROR);
  });

  it("reads JPEG and WebP headers for the landscape plate", async () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b,
      0x08, 0x00, 0x20, 0x00, 0x40, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
    ]);
    expect(parseJpegSize(jpeg)).toEqual({ w: 64, h: 32 });
    const jpegLogo = await readLogoFile(
      new File([jpeg], "mark.jpg", { type: "image/jpeg" })
    );
    expect(jpegLogo.kind).toBe("raster");
    if (jpegLogo.kind !== "raster") return;
    expect(jpegLogo.width).toBe(64);
    expect(jpegLogo.height).toBe(32);
    expect(jpegLogo.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);

    const webp = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x16, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x1f, 0x00, 0x00, 0x0f, 0x00, 0x00,
    ]);
    expect(parseWebpSize(webp)).toEqual({ w: 32, h: 16 });
    const webpLogo = await readLogoFile(
      new File([webp], "mark.webp", { type: "image/webp" })
    );
    expect(webpLogo.kind).toBe("raster");
    if (webpLogo.kind !== "raster") return;
    expect(webpLogo.width).toBe(32);
    expect(webpLogo.height).toBe(16);
    expect(webpLogo.dataUrl.startsWith("data:image/webp;base64,")).toBe(true);
    expect(badgeLogoPreviewSrc(webpLogo)).toBe(webpLogo.dataUrl);
  });

  it("prepares the seeded Cloudflare mark", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "public/connect/badge-demo-logo.svg"),
      "utf8"
    );
    const prepared = prepareBadgeLogo(svg);
    expect(prepared.markSvg).toContain('fill="white"');
    expect(extractSvgInner(svg)).toContain("<path");
    expect(badgeShaderPlateSvg(svg)).toContain("M29.818");
    const mark = badgeMarkSvg(svg, "#f46021");
    expect(mark).toContain(`width="${BADGE_MARK_RASTER}"`);
    expect(svgRasterSize({ w: 37, h: 17 })).toEqual({
      w: BADGE_MARK_RASTER,
      h: Math.round(BADGE_MARK_RASTER * (17 / 37)),
    });
  });

  it("prepares a Discord-style wordmark with p3 fills", () => {
    const svg = readFileSync(
      resolve(process.cwd(), "src/components/logo-cloud/_svg/logo-discord.svg"),
      "utf8"
    );
    const prepared = prepareBadgeLogo(svg);
    expect(prepared.colorSvg).toContain("#5865F2");
    expect(prepared.markSvg).toContain('width="106"');
    expect(prepared.markSvg).toContain('height="16"');
    expect(prepared.markSvg).toContain('fill="white"');
    expect(prepared.markSvg).not.toMatch(/#5865F2/i);
    expect(prepared.markSvg).not.toContain("display-p3");
  });

  it("rebuilds the shader plate when the SVG changes", () => {
    const rect = badgeShaderPlateSvg(
      `<svg viewBox="0 0 40 20"><path d="M0 0h40v20z"/></svg>`
    );
    const circle = badgeShaderPlateSvg(
      `<svg viewBox="0 0 40 20"><circle cx="20" cy="10" r="8"/></svg>`
    );
    expect(rect).toContain("M0 0h40v20z");
    expect(rect).not.toContain("<circle");
    expect(circle).toContain('<circle cx="20"');
    expect(circle).not.toContain("M0 0h40v20z");
  });

  it("uses the full Connect-cloud SVG as the fallback stripe source", () => {
    const fieldPath = resolve(
      process.cwd(),
      "public/connect/badge-print-field.svg"
    );
    const field = readFileSync(fieldPath, "utf8");
    const overlay = readFileSync(
      resolve(process.cwd(), "public/connect/badge-demo-logo.svg"),
      "utf8"
    );
    expect(field).toContain('fill="#000000"');
    expect(field).toContain('stroke="#ffffff"');
    expect(field).toContain("url(#badge-print-lit)");
    expect(field).toContain('width="1600"');
    expect(field).toContain('height="1200"');
    expect(field).toContain('viewBox="0 0 800 600"');
    expect(field).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(field).toContain("M226.32 47.1364");
    expect(overlay).toContain("M29.818");
    expect(field).not.toContain("M29.818");
    expect(BADGE_PRINT_FIELD_SRC).toBe("/connect/badge-print-field.svg?v=dark");

    const shader = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgePrintShader.tsx"
      ),
      "utf8"
    );
    expect(shader).toContain("src: string");
    expect(shader).toContain("image.src = src");
    expect(shader).toContain("engine.setSource(null)");
    expect(shader).toContain("blitPrintFrame");
    expect(shader).not.toContain("[canvasRef, height, maxDpr, src, width]");

    const upload = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeLogoUpload.tsx"
      ),
      "utf8"
    );
    expect(upload).toContain("Add company logo");
    expect(upload).toContain("DashedCircle");
    expect(upload).not.toContain("PanelGrip");
    expect(upload).toContain("Logo size");
    expect(upload).toContain("object-contain");
    expect(upload).toContain("bg-[#000]");
    expect(upload).toContain('backgroundColor: "#000000"');
    expect(upload).toContain("src={plateSrc}");
    expect(upload).not.toContain("previewSrc ?? plateSrc");
    expect(upload).not.toContain('tone="dark"');
    expect(upload).toContain('side="top"');
    expect(upload).toContain("scroll={false}");
    expect(upload).toContain("maskImage");
    expect(upload).toContain("Replace");
    expect(upload).toContain("Remove");
    expect(upload).toContain("LOGO_FILE_ACCEPT");
    expect(upload).toContain("sourcePanX");
    expect(upload).toContain("logoScale");
    expect(upload).toContain("Dropdown");
    expect(upload).toContain("aspect-4/3");
    expect(upload).toContain("BadgeInspectorField");
    expect(upload).toContain("rounded-12");
    expect(upload).toContain("Adjust");
    expect(upload).not.toContain("Upload logo");
    expect(upload).not.toContain("Drag to move");
    expect(upload).not.toContain("Shader source");
    expect(upload).not.toContain('type="range"');

    const customizer = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeCustomizer.tsx"
      ),
      "utf8"
    );
    expect(customizer).toContain("BadgeLogoUpload");
    expect(customizer).toContain("BadgeColorPicker");
    expect(customizer).toContain("BADGE_PRESET_THEMES");
    expect(customizer).toContain('role="radiogroup"');
    expect(customizer).toContain("h-13 w-px rounded-full bg-border-default");
    expect(customizer).toContain("badgeMarkFill");

    const picker = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeColorPicker.tsx"
      ),
      "utf8"
    );
    expect(picker).toContain("react-colorful");
    expect(picker).toContain("HexColorPicker");
    expect(picker).toContain("HexColorInput");
    expect(picker).toContain("Custom color");
    expect(picker).toContain("badge-color-picker__wheel");
    expect(picker).toContain("plus-small");

    const pickerCss = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeColorPicker.css"
      ),
      "utf8"
    );
    expect(pickerCss).toContain("conic-gradient");
    expect(pickerCss).toContain("in oklch");

    const page = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgePage.tsx"
      ),
      "utf8"
    );
    expect(page).toContain("plateSrc={plateSrc}");
    expect(page).toContain("printSrc={plateSrc}");
    expect(page).toContain("h-760");
    expect(page).toContain("sourceZoom");
    expect(page).toContain("readLogoFile");
    expect(page).toContain("badgeShaderPlateRaster");
    expect(page).toContain("JPEG, WebP, PNG, or SVG");
    expect(page).toContain("setTune");
    expect(page).toContain("defaultOpen: false");
    expect(page).not.toContain("defaultOpen: true");
    expect(page).toContain("onPanChange");
    expect(page).toContain("onScaleChange");
    expect(page).toContain("applyBadgeTwizzlerOverlay");
    expect(page).toContain("cardTextureConfig");
    expect(page).toContain("cardStripes");
    expect(page).toContain('fit: "width"');
    expect(page).toContain("whitePoint: 0.8");
    expect(page).toContain("Copy shareable card");
    expect(page).toContain("CopyFeedbackLabel");
    expect(page).toContain("<span>Share</span>");
    expect(page).not.toContain("Share on X");
    expect(page).toContain("badgeTweetUrl(badgeShareHeadline(view.name))");
    expect(page).toContain("noopener,noreferrer");
    expect(page).not.toContain('window.open("about:blank"');
    expect(page).toContain("paused={reducedMotion || !shaderLive}");
    expect(page).toContain("text-balance");
    expect(page).toContain("captureHeroShare");
    expect(page).toContain("captureHeroShare(scene)");
    expect(page).not.toContain("captureHeroShare(hero, title)");
    expect(page).not.toContain("flushSync");
    expect(page).not.toContain("shareCapture");
    expect(page).not.toContain("disabled={sharing}");
    expect(page).toContain("text-left");
    expect(page).toContain("BadgeShareDock");
    expect(page).toContain("shareSceneRef");
    expect(page).toContain('data-share-scene=""');
    expect(page).toContain("data-share-title");
    expect(page).toContain('data-share-layer="behind"');
    expect(page).toContain("data-share-grid");
    expect(page).toContain("data-share-mask");
    expect(page).toContain("shareBackdrop");
    expect(page).toContain("justify-center");
    expect(page).not.toContain("Copy badge link");
    expect(page).not.toContain("Register now");
    expect(page).toContain("Your Connect 2026 badge");
    expect(LOGO_FILE_ACCEPT).toContain("image/jpeg");
    expect(LOGO_FILE_ACCEPT).toContain("image/webp");

    const dock = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeShareDock.tsx"
      ),
      "utf8"
    );
    expect(dock).toContain("createPortal");
    expect(dock).toContain("z-10000");
    expect(dock).toContain("size-32");
    expect(dock).toContain("max-w-280");
    expect(dock).toContain("overflow-hidden");
    expect(dock).toContain("opacity-40");
    expect(dock).toContain("hover:opacity-100");
    expect(dock).toContain("shadow-elevation-default-drops");
    expect(dock).toContain("rounded-16");
    expect(dock).toContain("draggable");
    expect(dock).toContain("cross-small");
    expect(dock).toContain('filter: "blur(6px)"');
    expect(dock).toContain("scale: 0.88");
    expect(dock).not.toContain("hover:scale-105");
    expect(dock).not.toContain("Right-click the image to save");
    expect(dock).not.toContain("before:inside-border");

    const lanyard = readFileSync(
      resolve(
        process.cwd(),
        "src/components/_pages/connect/badge/BadgeLanyard.tsx"
      ),
      "utf8"
    );
    expect(lanyard).toContain("applyBadgeLook");
    expect(lanyard).toContain("BADGE_DPR_MAX");
    expect(lanyard).toContain("envMapIntensity: 0.85");
    expect(lanyard).toContain("BADGE_ACCENT_LIGHTS");
    expect(lanyard).toContain("BADGE_PRINT_ROUGHNESS");
    expect(lanyard).toContain("BADGE_COAT_MESH_NAME");
    expect(lanyard).toContain("AdditiveBlending");
    expect(lanyard).toContain("MeshBasicMaterial");
    expect(lanyard).not.toContain("EffectComposer");
    expect(lanyard).not.toContain("Bloom");
    expect(lanyard).toContain('"contain"');
    expect(lanyard).toContain("preserveDrawingBuffer");
    expect(lanyard).toContain("setClearColor");
    expect(lanyard).toContain("dataset.shareStamp");
    expect(lanyard).toContain("bakedWhileFrozen.current = false");
    expect(lanyard).not.toContain("Boolean(logoMarkSrc)");
    expect(lanyard).toContain("shaderLive && !reducedMotion");
    expect(lanyard).toContain("applyIntroPose(rig.rope, rig.card)");
    expect(lanyard).toContain("cardBottomDragOffsetY");
    expect(lanyard).toContain("INTRO_DELAY_MS");
    expect(lanyard).toContain("INTRO_FADE_MS");
    expect(lanyard).toContain("onIntroReady");
    expect(lanyard).not.toContain("kickIntroSwing");
    expect(lanyard).not.toContain("logBadgePose");
    expect(lanyard).not.toContain("POSE_LOG_MS");
    expect(lanyard).not.toContain("INTRO_YAW");
    expect(lanyard).not.toContain("INTRO_ROLL");
    expect(lanyard).not.toContain("introRopePoint");
    expect(lanyard).toContain("stepRope");
    expect(lanyard).toContain("BADGE_CHAIN_BONES");
    expect(lanyard).toContain("CARD_FRONT_Z");
    expect(lanyard).not.toContain("INTRO_SPIN");
    expect(lanyard).not.toContain("INTRO_X");
    expect(lanyard).toContain("visible={introVisible}");
    expect(lanyard).toContain("document.fonts.ready");
    expect(page).toContain("AnimatePresence");
    expect(page).toContain('key="badge-share"');
    expect(lanyard).toContain("whiteLogoHalo");
    expect(lanyard).toContain('fillStyle = "#ffffff"');
    expect(lanyard).toContain("source-in");
    expect(page).not.toContain("src={logoMarkSrc");
    expect(page).not.toContain("<BadgeShaderSource");
    expect(page).not.toContain("<BadgeLogoUpload");
  });
});
