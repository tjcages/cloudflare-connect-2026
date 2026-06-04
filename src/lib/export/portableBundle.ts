import asciiVideoSource from "./portable/AsciiVideo.tsx?raw";
import colorSpaceSource from "./portable/colorSpace.ts?raw";
import playgroundColorSpaceSource from "./portable/playgroundColorSpace.ts?raw";
import pixiSource from "./portable/pixi.tsx?raw";
import pixiUtilsSource from "./portable/pixiUtils.ts?raw";
import sceneSource from "./portable/scene.ts?raw";
import shadersSource from "./portable/shaders.ts?raw";
import blockGridTextureSource from "./portable/runtime/blockGridTexture.ts?raw";
import colorWhitenessSource from "./portable/runtime/colorWhiteness.ts?raw";
import computeBlockGridSource from "./portable/runtime/computeBlockGrid.ts?raw";
import prngSource from "./portable/runtime/prng.ts?raw";
import samplePlaygroundFrameSource from "./portable/runtime/samplePlaygroundFrame.ts?raw";
import stabilizeBlockGridSource from "./portable/runtime/stabilizeBlockGrid.ts?raw";
import stripesSource from "./portable/runtime/stripes.ts?raw";
import stripePaletteTextureSource from "./portable/runtime/stripePaletteTexture.ts?raw";
import stripeGridConstantsSource from "./portable/runtime/stripeGridConstants.ts?raw";
import stripeLetterFontSource from "./portable/runtime/stripeLetterFont.ts?raw";
import stripeLetterLayerSource from "./portable/runtime/stripeLetterLayer.ts?raw";
import stripeLetterPlacementsSource from "./portable/runtime/stripeLetterPlacements.ts?raw";
import playgroundSparkleSource from "./portable/runtime/playgroundSparkle.ts?raw";

const RUNTIME_SOURCES: Record<string, string> = {
  "blockGridTexture.ts": blockGridTextureSource,
  "colorWhiteness.ts": colorWhitenessSource,
  "computeBlockGrid.ts": computeBlockGridSource,
  "prng.ts": prngSource,
  "samplePlaygroundFrame.ts": samplePlaygroundFrameSource,
  "stabilizeBlockGrid.ts": stabilizeBlockGridSource,
  "stripes.ts": stripesSource,
  "stripePaletteTexture.ts": stripePaletteTextureSource,
  "stripeGridConstants.ts": stripeGridConstantsSource,
  "stripeLetterFont.ts": stripeLetterFontSource,
  "stripeLetterLayer.ts": stripeLetterLayerSource,
  "stripeLetterPlacements.ts": stripeLetterPlacementsSource,
  "playgroundSparkle.ts": playgroundSparkleSource,
};

export type PortableExportFile = {
  relativePath: string;
  language: string;
  content: string;
};

export function buildPortableExportFiles(options: {
  directory: string;
  entryFileName: string;
  typesContent: string;
}): PortableExportFile[] {
  const { directory, entryFileName, typesContent } = options;

  const runtimeFiles = Object.entries(RUNTIME_SOURCES).map(([name, content]) => ({
    relativePath: `${directory}/runtime/${name}`,
    language: "typescript",
    content,
  }));

  return [
    { relativePath: `${directory}/shaders.ts`, language: "typescript", content: shadersSource },
    { relativePath: `${directory}/colorSpace.ts`, language: "typescript", content: colorSpaceSource },
    {
      relativePath: `${directory}/playgroundColorSpace.ts`,
      language: "typescript",
      content: playgroundColorSpaceSource,
    },
    { relativePath: `${directory}/types.ts`, language: "typescript", content: typesContent },
    { relativePath: `${directory}/scene.ts`, language: "typescript", content: sceneSource },
    { relativePath: `${directory}/pixi.tsx`, language: "typescript", content: pixiSource },
    { relativePath: `${directory}/pixiUtils.ts`, language: "typescript", content: pixiUtilsSource },
    ...runtimeFiles,
    { relativePath: `${directory}/${entryFileName}`, language: "typescript", content: asciiVideoSource },
  ];
}
