import { Container, Sprite } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import {
  scheduleInitialLetterShuffleAt,
  scheduleNextLetterShuffleAt,
} from "./playgroundLetterShuffle";
import {
  isPlaygroundSparkleCellVisible,
  type PlaygroundSparkleOptions,
} from "./playgroundSparkle";
import { STRIPE_CELL_SIZE } from "./stripeGridConstants";
import { computeStripeLetterPlacements, type StripeLetterPlacement } from "./stripeLetterPlacements";
import { STRIPE_LETTER_CHARSET, type StripeLetterAtlas } from "./stripeLetterFont";

const STRIPE_LETTER_TINT = 0xffffff;

function stripeLetterPlacementKey(placements: readonly StripeLetterPlacement[]): string {
  return placements
    .map((placement) => `${placement.col},${placement.row}`)
    .sort()
    .join("|");
}

function stripeLetterCellKey(placement: Pick<StripeLetterPlacement, "col" | "row">): string {
  return `${placement.col},${placement.row}`;
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
  const nextShuffleAtByCell = new Map<string, number>();

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

  const syncShuffleTimers = (nowMs: number = performance.now()) => {
    const activeKeys = new Set<string>();
    for (const placement of placements) {
      const key = stripeLetterCellKey(placement);
      activeKeys.add(key);
      if (!nextShuffleAtByCell.has(key)) {
        nextShuffleAtByCell.set(key, scheduleInitialLetterShuffleAt(nowMs));
      }
    }
    for (const key of nextShuffleAtByCell.keys()) {
      if (!activeKeys.has(key)) {
        nextShuffleAtByCell.delete(key);
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
      nextShuffleAtByCell.clear();
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

    syncShuffleTimers();
  };

  const tickLetterShuffle = (nowMs: number = performance.now(), charset: readonly string[] = STRIPE_LETTER_CHARSET) => {
    if (charset.length === 0 || sprites.length !== placements.length) {
      return;
    }

    syncShuffleTimers(nowMs);

    for (let i = 0; i < sprites.length; i++) {
      const placement = placements[i];
      const sprite = sprites[i];
      if (!placement || !sprite) {
        continue;
      }

      const key = stripeLetterCellKey(placement);
      const nextShuffleAt = nextShuffleAtByCell.get(key);
      if (nextShuffleAt === undefined || nowMs < nextShuffleAt) {
        continue;
      }

      const charIndex = Math.floor(Math.random() * charset.length);
      const char = charset[charIndex] ?? charset[0] ?? "?";
      placement.char = char;
      applyGlyphToSprite(sprite, char);
      nextShuffleAtByCell.set(key, scheduleNextLetterShuffleAt(nowMs));
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
    nextShuffleAtByCell.clear();
    container.destroy({ children: true });
  };

  return { container, sync, tickLetterShuffle, applySparkle, setVisible, destroy };
}
