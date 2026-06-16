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
import { computeStripeLetterPlacements, type StripeLetterPlacement } from "./stripeLetterPlacements";
import { STRIPE_LETTER_CHARSET, type StripeLetterAtlas } from "./stripeLetterFont";

const STRIPE_LETTER_TINT = 0xffffff;

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
  destroy: () => void;
};

export function createStripeLetterLayer(atlas: StripeLetterAtlas): StripeLetterLayer {
  const container = new Container();
  const sprites: Sprite[] = [];
  let placements: StripeLetterPlacement[] = [];
  const cycleStateByCell = new Map<string, LetterCycleState>();

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
    // eslint-disable-next-line no-restricted-properties -- random glyph for letter shuffle, not grid PRNG
    const charIndex = Math.floor(Math.random() * charset.length);
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

    const nextPlacements = computeStripeLetterPlacements(grid);
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
      sprite.tint = STRIPE_LETTER_TINT;
      sprite.position.set(
        placement.col * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5,
        placement.row * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5,
      );
      sprites.push(sprite);
      container.addChild(sprite);
    }

    syncCycleStates();
  };

  const tickLetterShuffle = (nowMs: number = performance.now(), charset: readonly string[] = STRIPE_LETTER_CHARSET) => {
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

      if (state.stepsRemaining <= 0) {
        state.phase = "idle";
        state.nextEventAt = nowMs + randomLetterCycleDelayMs();
      } else {
        state.nextEventAt = nowMs + randomLetterCycleStepDelayMs();
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

  const destroy = () => {
    for (const sprite of sprites) {
      sprite.destroy();
    }
    sprites.length = 0;
    placements = [];
    cycleStateByCell.clear();
    container.destroy({ children: true });
  };

  return { container, sync, tickLetterShuffle, applySparkle, setVisible, destroy };
}
