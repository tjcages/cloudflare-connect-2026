import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, type StripeDuotoneOptions } from "./stripeFilterOptions";
import { buildStripeColors, stripeColorsToUniformRgb, type StripeColors } from "./stripeColors";

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

/** Set > 0 to composite source video for grid-alignment debugging. */
export const STRIPE_DEBUG_VIDEO_OVERLAY_ALPHA = 0;

/** Reads precomputed block bands from uBlockMap (nearest). */
const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBlockMap;
uniform vec2 uPixelSize;
uniform vec2 uFrameSize;
uniform vec2 uGridSize;
uniform vec3 uColorBand0;
uniform vec3 uColorBand1;
uniform vec3 uColorBand2;
uniform vec3 uColorBand3;
uniform vec3 uColorBand4;
uniform float uBandEnabled0;
uniform float uBandEnabled1;
uniform float uBandEnabled2;
uniform float uBandEnabled3;
uniform float uBandEnabled4;
uniform float uDebugVideoAlpha;

const float CELL_SIZE = 7.0;
const float STRIPE_BAND_COUNT = 5.0;
const float STRIPE_MAX_WIDTH = 5.0;
const float MIN_STRIPE_HEIGHT = 7.0;
const float ROW_WIDTH_GAP = 1.0;

bool sameStripeBand(float a, float b) {
    if (a < 0.5 || b < 0.5) {
        return false;
    }
    return abs(a - b) < 0.001;
}

bool stripePixelVisible(float relX, float localY, float halfW, float bandTop, float bandBottom) {
    return abs(relX) <= halfW + 0.001 && localY >= bandTop - 0.001 && localY <= bandBottom + 0.001;
}

float decodeStripeBand(float encoded) {
    if (encoded < 0.5 / STRIPE_BAND_COUNT) {
        return 0.0;
    }
    if (encoded >= 4.5 / STRIPE_BAND_COUNT) {
        return 5.0;
    }
    if (encoded >= 3.5 / STRIPE_BAND_COUNT) {
        return 4.0;
    }
    if (encoded >= 2.5 / STRIPE_BAND_COUNT) {
        return 3.0;
    }
    if (encoded >= 1.5 / STRIPE_BAND_COUNT) {
        return 2.0;
    }
    return 1.0;
}

float widthPxFromBand(float band) {
    if (band < 0.5) {
        return 0.0;
    }
    return min(STRIPE_MAX_WIDTH, max(1.0, ceil(band * STRIPE_MAX_WIDTH / STRIPE_BAND_COUNT)));
}

vec2 blockGridUv(float colIndex, float rowIndex) {
    float gridRow = uGridSize.y - 1.0 - rowIndex;
    return vec2(
        (colIndex + 0.5) / uGridSize.x,
        (gridRow + 0.5) / uGridSize.y
    );
}

float blockStripeBand(float colIndex, float rowIndex) {
    return decodeStripeBand(texture(uBlockMap, blockGridUv(colIndex, rowIndex)).r);
}

bool stripeBandEnabled(float band) {
    if (band < 1.5) {
        return uBandEnabled0 > 0.5;
    }
    if (band < 2.5) {
        return uBandEnabled1 > 0.5;
    }
    if (band < 3.5) {
        return uBandEnabled2 > 0.5;
    }
    if (band < 4.5) {
        return uBandEnabled3 > 0.5;
    }
    return uBandEnabled4 > 0.5;
}

vec3 stripeFillColor(float band) {
    if (band < 1.5) {
        return uColorBand0;
    }
    if (band < 2.5) {
        return uColorBand1;
    }
    if (band < 3.5) {
        return uColorBand2;
    }
    if (band < 4.5) {
        return uColorBand3;
    }
    return uColorBand4;
}

void main(void) {
    vec2 pixelCoord = vTextureCoord * uPixelSize;

    float colIndex = floor(pixelCoord.x / CELL_SIZE);
    float rowIndex = floor(pixelCoord.y / CELL_SIZE);
    float maxRowIndex = max(0.0, floor((uFrameSize.y - 1.0) / CELL_SIZE));
    float columnCenterPx = (colIndex + 0.5) * CELL_SIZE;
    float localY = pixelCoord.y - rowIndex * CELL_SIZE;

    float stripeBand = blockStripeBand(colIndex, rowIndex);
    float bandAbove = rowIndex > 0.0
        ? blockStripeBand(colIndex, rowIndex - 1.0)
        : 0.0;
    float bandBelow = rowIndex < maxRowIndex
        ? blockStripeBand(colIndex, rowIndex + 1.0)
        : 0.0;

    bool chainBreaksAbove = stripeBand > 0.5 && !sameStripeBand(stripeBand, bandAbove);
    bool chainBreaksBelow = stripeBand > 0.5 && !sameStripeBand(stripeBand, bandBelow);

    float gapTop = chainBreaksAbove ? ROW_WIDTH_GAP * 0.5 : 0.0;
    float gapBottom = chainBreaksBelow ? ROW_WIDTH_GAP * 0.5 : 0.0;

    float bandTop = gapTop;
    float bandBottom = CELL_SIZE - gapBottom;

    if (bandBottom - bandTop < MIN_STRIPE_HEIGHT) {
        bandTop = 0.0;
        bandBottom = CELL_SIZE;
    }
    float stripeWidth = widthPxFromBand(stripeBand);
    float halfW = stripeWidth * 0.5;
    float relX = pixelCoord.x - columnCenterPx;

    if (stripeBand > 0.5 && stripeBandEnabled(stripeBand) && stripePixelVisible(relX, localY, halfW, bandTop, bandBottom)) {
        finalColor = vec4(stripeFillColor(stripeBand), 1.0);
    } else {
        finalColor = vec4(1.0, 1.0, 1.0, 1.0);
    }

    if (uDebugVideoAlpha > 0.0) {
        vec4 videoPx = texture(uTexture, vTextureCoord);
        finalColor = mix(finalColor, videoPx, uDebugVideoAlpha);
    }
}
`;

export type StripeDuotoneFilter = Filter & {
  syncOptions: (options: StripeDuotoneOptions) => void;
  syncColors: (colors: StripeColors, preferP3?: boolean) => void;
  updateBlockMap: (blockMap: Texture) => void;
};

function bindBlockMapTexture(filter: Filter, blockMap: Texture) {
  blockMap.source.style.scaleMode = "nearest";
  filter.resources.uBlockMap = blockMap.source;
}

function copyRgbUniform(target: number[] | Float32Array, source: readonly [number, number, number]) {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
}

function applyStripeColors(stripeUniforms: UniformGroup, colors: StripeColors, preferP3 = false) {
  const rgb = stripeColorsToUniformRgb(colors, preferP3);
  const uniforms = stripeUniforms.uniforms as {
    uColorBand0: number[];
    uColorBand1: number[];
    uColorBand2: number[];
    uColorBand3: number[];
    uColorBand4: number[];
    uBandEnabled0: number;
    uBandEnabled1: number;
    uBandEnabled2: number;
    uBandEnabled3: number;
    uBandEnabled4: number;
  };
  copyRgbUniform(uniforms.uColorBand0, rgb[0]);
  copyRgbUniform(uniforms.uColorBand1, rgb[1]);
  copyRgbUniform(uniforms.uColorBand2, rgb[2]);
  copyRgbUniform(uniforms.uColorBand3, rgb[3]);
  copyRgbUniform(uniforms.uColorBand4, rgb[4]);
  uniforms.uBandEnabled0 = colors.enabled[0] ? 1 : 0;
  uniforms.uBandEnabled1 = colors.enabled[1] ? 1 : 0;
  uniforms.uBandEnabled2 = colors.enabled[2] ? 1 : 0;
  uniforms.uBandEnabled3 = colors.enabled[3] ? 1 : 0;
  uniforms.uBandEnabled4 = colors.enabled[4] ? 1 : 0;
}

export function createStripeDuotoneFilter(
  _canvasWidth: number,
  _canvasHeight: number,
  blockMap: Texture,
  gridCols: number,
  gridRows: number,
  colors: StripeColors = buildStripeColors(),
  _options: StripeDuotoneOptions = DEFAULT_STRIPE_DUOTONE_OPTIONS,
  preferP3 = false,
): StripeDuotoneFilter {
  const initialRgb = stripeColorsToUniformRgb(colors, preferP3);
  const stripeUniforms = new UniformGroup({
    uPixelSize: {
      value: [_canvasWidth, _canvasHeight],
      type: "vec2<f32>",
    },
    uFrameSize: {
      value: [_canvasWidth, _canvasHeight],
      type: "vec2<f32>",
    },
    uGridSize: {
      value: [gridCols, gridRows],
      type: "vec2<f32>",
    },
    uColorBand0: {
      value: initialRgb[0],
      type: "vec3<f32>",
    },
    uColorBand1: {
      value: initialRgb[1],
      type: "vec3<f32>",
    },
    uColorBand2: {
      value: initialRgb[2],
      type: "vec3<f32>",
    },
    uColorBand3: {
      value: initialRgb[3],
      type: "vec3<f32>",
    },
    uColorBand4: {
      value: initialRgb[4],
      type: "vec3<f32>",
    },
    uBandEnabled0: { value: 1, type: "f32" },
    uBandEnabled1: { value: 1, type: "f32" },
    uBandEnabled2: { value: 1, type: "f32" },
    uBandEnabled3: { value: 1, type: "f32" },
    uBandEnabled4: { value: 1, type: "f32" },
    uDebugVideoAlpha: {
      value: STRIPE_DEBUG_VIDEO_OVERLAY_ALPHA,
      type: "f32",
    },
  });

  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex,
      fragment,
    }),
    clipToViewport: false,
    padding: 0,
    resources: {
      stripeUniforms,
      uBlockMap: blockMap.source,
    },
  }) as StripeDuotoneFilter;

  let currentBlockMap = blockMap;
  bindBlockMapTexture(filter, currentBlockMap);
  applyStripeColors(stripeUniforms, colors, preferP3);

  filter.syncOptions = () => {
    // Block map carries bands; bg options affect CPU grid rebuild only.
  };

  filter.syncColors = (nextColors, nextPreferP3 = preferP3) => {
    applyStripeColors(stripeUniforms, nextColors, nextPreferP3);
  };

  filter.updateBlockMap = (nextBlockMap) => {
    currentBlockMap = nextBlockMap;
    bindBlockMapTexture(filter, nextBlockMap);
  };

  const pixelSizeUniform = stripeUniforms.uniforms.uPixelSize as number[];
  const frameSizeUniform = stripeUniforms.uniforms.uFrameSize as number[];

  const baseApply = filter.apply.bind(filter);
  filter.apply = (filterManager, input, output, clearMode) => {
    bindBlockMapTexture(filter, currentBlockMap);
    const sourceW = input.source.width;
    const sourceH = input.source.height;
    const frameW = input.frame.width;
    const frameH = input.frame.height;
    if (sourceW > 0 && sourceH > 0) {
      pixelSizeUniform[0] = sourceW;
      pixelSizeUniform[1] = sourceH;
    }
    if (frameW > 0 && frameH > 0) {
      frameSizeUniform[0] = frameW;
      frameSizeUniform[1] = frameH;
    }
    stripeUniforms.update();
    baseApply(filterManager, input, output, clearMode);
  };

  return filter;
}
