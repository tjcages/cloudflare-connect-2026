import { Container, Sprite } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import {
  randomLetterCycleDelayMs,
  randomLetterCycleIterationCount,
  randomLetterCycleStepDelayMs,
  scheduleInitialLetterCycleAt,
} from "./playgroundLetterShuffle";
import { isPlaygroundSparkleCellVisible, type PlaygroundSparkleOptions } from "./playgroundSparkle";
import { STRIPE_CELL_SIZE } from "./stripeGridConstants";
import {
  computeStripeLetterPlacements,
  STRIPE_LETTER_COVERAGE,
  type StripeLetterPlacement,
} from "./stripeLetterPlacements";
import { STRIPE_LETTER_CHARSET, type StripeLetterAtlas } from "./stripeLetterFont";

const STRIPE_LETTER_TINT = 0xffffff;

/** u∈[0,1) from `crypto` so letter cycling does not use `Math.random` (reserved for non-grid policy). */
function randomUnitInterval(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}

export type StripeLetterLayerOptions = {
  cellWidth?: number;
  cellHeight?: number;
  orientation?: "vertical" | "horizontal";
  tint?: number;
  ratio?: number;
  charset?: readonly string[];
  shuffleSpeed?: number;
};

type LetterCyclePhase = "idle" | "cycling";

type LetterCycleState = {
  phase: LetterCyclePhase;
  nextEventAt: number;
  stepsRemaining: number;
};

function stripeLetterPlacementKey(placements: readonly StripeLetterPlacement[]): string {
  return placements
    .map((placement) => `${placement.col},${placement.row}`)
    .sort()
    .join("|");
}

function stripeLetterCellKey(placement: Pick<StripeLetterPlacement, "col" | "row">): string {
  return `${placement.col},${placement.row}`;
}

function createInitialCycleState(nowMs: number): LetterCycleState {
  return {
    phase: "idle",
    nextEventAt: scheduleInitialLetterCycleAt(nowMs),
    stepsRemaining: 0,
  };
}

export type StripeLetterLayer = {
  container: Container;
  sync: (grid: BlockGrid | null) => void;
  tickLetterShuffle: (nowMs?: number, charset?: readonly string[]) => void;
  applySparkle: (timeSec: number, options: PlaygroundSparkleOptions) => void;
  setVisible: (visible: boolean) => void;
  setTint: (tint: number) => void;
  setShuffleSpeed: (speed: number) => void;
  destroy: () => void;
};

export function createStripeLetterLayer(
  atlas: StripeLetterAtlas,
  options: StripeLetterLayerOptions = {},
): StripeLetterLayer {
  const container = new Container();
  const sprites: Sprite[] = [];
  let placements: StripeLetterPlacement[] = [];
  const cycleStateByCell = new Map<string, LetterCycleState>();

  const cellWidth = options.cellWidth ?? STRIPE_CELL_SIZE;
  const cellHeight = options.cellHeight ?? STRIPE_CELL_SIZE;
  const ratio = options.ratio ?? STRIPE_LETTER_COVERAGE;
  const layerCharset = options.charset && options.charset.length > 0 ? options.charset : STRIPE_LETTER_CHARSET;
  let tint = options.tint ?? STRIPE_LETTER_TINT;
  let shuffleSpeed = options.shuffleSpeed && options.shuffleSpeed > 0 ? options.shuffleSpeed : 1;

  const applyGlyphToSprite = (sprite: Sprite, char: string) => {
    const glyph = atlas.get(char);
    if (!glyph) {
      return false;
    }
    sprite.texture = glyph.texture;
    sprite.width = glyph.width;
    sprite.height = glyph.height;
    return true;
  };

  const applyRandomLetter = (placement: StripeLetterPlacement, sprite: Sprite, charset: readonly string[]) => {
    const charIndex = Math.floor(randomUnitInterval() * charset.length);
    const char = charset[charIndex] ?? charset[0] ?? "?";
    placement.char = char;
    applyGlyphToSprite(sprite, char);
  };

  const syncCycleStates = (nowMs: number = performance.now()) => {
    const activeKeys = new Set<string>();
    for (const placement of placements) {
      const key = stripeLetterCellKey(placement);
      activeKeys.add(key);
      if (!cycleStateByCell.has(key)) {
        cycleStateByCell.set(key, createInitialCycleState(nowMs));
      }
    }
    for (const key of cycleStateByCell.keys()) {
      if (!activeKeys.has(key)) {
        cycleStateByCell.delete(key);
      }
    }
  };

  const sync = (grid: BlockGrid | null) => {
    if (!grid) {
      for (const sprite of sprites) {
        sprite.destroy();
      }
      sprites.length = 0;
      placements = [];
      cycleStateByCell.clear();
      container.removeChildren();
      return;
    }

    const nextPlacements = computeStripeLetterPlacements(grid, layerCharset, ratio);
    const nextKey = stripeLetterPlacementKey(nextPlacements);
    if (nextKey === stripeLetterPlacementKey(placements) && sprites.length > 0) {
      return;
    }

    const previousChars = new Map(
      placements.map((placement) => [stripeLetterCellKey(placement), placement.char] as const),
    );

    for (const sprite of sprites) {
      sprite.destroy();
    }
    sprites.length = 0;
    container.removeChildren();

    placements = nextPlacements.map((placement) => {
      const preserved = previousChars.get(stripeLetterCellKey(placement));
      return preserved === undefined ? placement : { ...placement, char: preserved };
    });

    for (const placement of placements) {
      const sprite = new Sprite();
      if (!applyGlyphToSprite(sprite, placement.char)) {
        sprite.destroy();
        continue;
      }

      sprite.anchor.set(0.5);
      sprite.roundPixels = true;
      sprite.tint = tint;
      sprite.position.set(placement.col * cellWidth + cellWidth * 0.5, placement.row * cellHeight + cellHeight * 0.5);
      sprites.push(sprite);
      container.addChild(sprite);
    }

    syncCycleStates();
  };

  const tickLetterShuffle = (nowMs: number = performance.now(), charset: readonly string[] = layerCharset) => {
    if (charset.length === 0 || sprites.length !== placements.length) {
      return;
    }

    syncCycleStates(nowMs);

    for (let i = 0; i < sprites.length; i++) {
      const placement = placements[i];
      const sprite = sprites[i];
      if (!placement || !sprite) {
        continue;
      }

      const key = stripeLetterCellKey(placement);
      const state = cycleStateByCell.get(key);
      if (!state || nowMs < state.nextEventAt) {
        continue;
      }

      if (state.phase === "idle") {
        state.phase = "cycling";
        state.stepsRemaining = randomLetterCycleIterationCount();
      }

      applyRandomLetter(placement, sprite, charset);
      state.stepsRemaining -= 1;

      const speed = shuffleSpeed > 0 ? shuffleSpeed : 1;
      if (state.stepsRemaining <= 0) {
        state.phase = "idle";
        state.nextEventAt = nowMs + randomLetterCycleDelayMs() / speed;
      } else {
        state.nextEventAt = nowMs + randomLetterCycleStepDelayMs() / speed;
      }
    }
  };

  const applySparkle = (timeSec: number, options: PlaygroundSparkleOptions) => {
    if (sprites.length !== placements.length) {
      return;
    }
    for (let i = 0; i < sprites.length; i++) {
      const placement = placements[i];
      const sprite = sprites[i];
      if (!placement || !sprite) {
        continue;
      }
      sprite.visible = isPlaygroundSparkleCellVisible(placement.col, placement.row, timeSec, options);
    }
  };

  const setVisible = (visible: boolean) => {
    container.visible = visible;
  };

  const setTint = (nextTint: number) => {
    if (nextTint === tint) {
      return;
    }
    tint = nextTint;
    for (const sprite of sprites) {
      sprite.tint = tint;
    }
  };

  const setShuffleSpeed = (speed: number) => {
    shuffleSpeed = speed > 0 ? speed : 1;
  };

  const destroy = () => {
    for (const sprite of sprites) {
      sprite.destroy();
    }
    sprites.length = 0;
    placements = [];
    cycleStateByCell.clear();
    container.destroy({ children: true });
  };

  return { container, sync, tickLetterShuffle, applySparkle, setVisible, setTint, setShuffleSpeed, destroy };
}
