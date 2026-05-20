import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import { DEFAULT_STRIPE_DUOTONE_OPTIONS, type StripeDuotoneOptions } from "./stripeFilterOptions";
import { buildStripeColors, type StripeColors } from "./stripeColors";
import { DEFAULT_CONFIG } from "../grid/config";

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

/** Reads precomputed block widths from uBlockMap (nearest, 1–3 taps per pixel). */
const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBlockMap;
uniform vec2 uPixelSize;
uniform vec2 uFrameSize;
uniform vec2 uGridSize;
uniform vec3 uColorNarrow;
uniform vec3 uColorMid;
uniform vec3 uColorWide;
uniform float uDebugVideoAlpha;

const float CELL_SIZE = 7.0;
const float ROW_WIDTH_GAP = 0.5;
const float CHAIN_CAP_RADIUS = 2.0;

bool sameStripeWidth(float a, float b) {
    return a > 0.001 && abs(a - b) < 0.001;
}

// Trim square corners so only the top/bottom of a same-width vertical run is rounded.
bool stripePixelVisible(
    float relX,
    float localY,
    float halfW,
    float bandTop,
    float bandBottom,
    bool roundTop,
    bool roundBottom
) {
    if (abs(relX) >= halfW || localY < bandTop || localY >= bandBottom) {
        return false;
    }

    float capR = min(CHAIN_CAP_RADIUS, halfW);

    if (roundTop && localY < bandTop + capR) {
        if (relX <= -halfW + capR) {
            vec2 c = vec2(-halfW + capR, bandTop + capR);
            if (distance(vec2(relX, localY), c) > capR) {
                return false;
            }
        } else if (relX >= halfW - capR) {
            vec2 c = vec2(halfW - capR, bandTop + capR);
            if (distance(vec2(relX, localY), c) > capR) {
                return false;
            }
        }
    }

    if (roundBottom && localY > bandBottom - capR) {
        if (relX <= -halfW + capR) {
            vec2 c = vec2(-halfW + capR, bandBottom - capR);
            if (distance(vec2(relX, localY), c) > capR) {
                return false;
            }
        } else if (relX >= halfW - capR) {
            vec2 c = vec2(halfW - capR, bandBottom - capR);
            if (distance(vec2(relX, localY), c) > capR) {
                return false;
            }
        }
    }

    return true;
}

float decodeStripeWidth(float encoded) {
    if (encoded > 0.75) {
        return 5.0;
    }
    if (encoded > 0.45) {
        return 3.0;
    }
    if (encoded > 0.05) {
        return 1.0;
    }
    return 0.0;
}

float blockStripeWidth(float colIndex, float rowIndex) {
    float gridRow = uGridSize.y - 1.0 - rowIndex;
    vec2 gridUv = vec2(
        (colIndex + 0.5) / uGridSize.x,
        (gridRow + 0.5) / uGridSize.y
    );
    return decodeStripeWidth(texture(uBlockMap, gridUv).r);
}

vec3 stripeFillColor(float stripeWidth) {
    if (stripeWidth > 4.5) {
        return uColorWide;
    }
    if (stripeWidth > 2.5) {
        return uColorMid;
    }
    return uColorNarrow;
}

void main(void) {
    // vTextureCoord * uPixelSize → output-frame pixels (see filter.apply sync).
    vec2 pixelCoord = vTextureCoord * uPixelSize;

    float colIndex = floor(pixelCoord.x / CELL_SIZE);
    float rowIndex = floor(pixelCoord.y / CELL_SIZE);
    float maxRowIndex = max(0.0, floor((uFrameSize.y - 1.0) / CELL_SIZE));

    float columnCenterPx = (colIndex + 0.5) * CELL_SIZE;
    float localY = pixelCoord.y - rowIndex * CELL_SIZE;

    float stripeWidth = blockStripeWidth(colIndex, rowIndex);

    float widthPrev = rowIndex > 0.0
        ? blockStripeWidth(colIndex, rowIndex - 1.0)
        : stripeWidth;
    float widthNext = rowIndex < maxRowIndex
        ? blockStripeWidth(colIndex, rowIndex + 1.0)
        : stripeWidth;

    float gapTop = (rowIndex > 0.0 && abs(stripeWidth - widthPrev) > 0.001)
        ? ROW_WIDTH_GAP * 0.5
        : 0.0;
    float gapBottom = (rowIndex < maxRowIndex && abs(stripeWidth - widthNext) > 0.001)
        ? ROW_WIDTH_GAP * 0.5
        : 0.0;

    float bandTop = gapTop;
    float bandBottom = CELL_SIZE - gapBottom;
    float halfW = stripeWidth * 0.5;
    float relX = pixelCoord.x - columnCenterPx;

    bool chainTop = stripeWidth > 0.001 && !sameStripeWidth(stripeWidth, widthPrev);
    bool chainBottom = stripeWidth > 0.001 && !sameStripeWidth(stripeWidth, widthNext);

    if (stripeWidth > 0.0 && stripePixelVisible(relX, localY, halfW, bandTop, bandBottom, chainTop, chainBottom)) {
        finalColor = vec4(stripeFillColor(stripeWidth), 1.0);
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
  syncColors: (colors: StripeColors) => void;
  updateBlockMap: (blockMap: Texture) => void;
};

function bindBlockMapTexture(filter: Filter, blockMap: Texture) {
  blockMap.source.style.scaleMode = "nearest";
  filter.resources.uBlockMap = blockMap.source;
}

function copyRgbUniform(target: number[] | Float32Array, source: StripeColors["narrow"]) {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
}

function applyStripeColors(stripeUniforms: UniformGroup, colors: StripeColors) {
  const uniforms = stripeUniforms.uniforms as {
    uColorNarrow: number[];
    uColorMid: number[];
    uColorWide: number[];
  };
  copyRgbUniform(uniforms.uColorNarrow, colors.narrow);
  copyRgbUniform(uniforms.uColorMid, colors.mid);
  copyRgbUniform(uniforms.uColorWide, colors.wide);
}

export function createStripeDuotoneFilter(
  _canvasWidth: number,
  _canvasHeight: number,
  blockMap: Texture,
  gridCols: number,
  gridRows: number,
  colors: StripeColors = buildStripeColors(DEFAULT_CONFIG.strokeColor),
  _options: StripeDuotoneOptions = DEFAULT_STRIPE_DUOTONE_OPTIONS,
): StripeDuotoneFilter {
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
    uColorNarrow: {
      value: colors.narrow,
      type: "vec3<f32>",
    },
    uColorMid: {
      value: colors.mid,
      type: "vec3<f32>",
    },
    uColorWide: {
      value: colors.wide,
      type: "vec3<f32>",
    },
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
  applyStripeColors(stripeUniforms, colors);

  filter.syncOptions = () => {
    // Block map carries widths; bg options affect CPU grid rebuild only.
  };

  filter.syncColors = (nextColors) => {
    applyStripeColors(stripeUniforms, nextColors);
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
