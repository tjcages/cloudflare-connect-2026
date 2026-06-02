import { Container, Sprite } from "pixi.js";
import type { BlockGrid } from "./computeBlockGrid";
import {
  isPlaygroundSparkleCellVisible,
  type PlaygroundSparkleOptions,
} from "./playgroundSparkle";
import { STRIPE_CELL_SIZE } from "./stripeGridConstants";
import { computeStripeLetterPlacements, type StripeLetterPlacement } from "./stripeLetterPlacements";
import type { StripeLetterAtlas } from "./stripeLetterFont";

const STRIPE_LETTER_TINT = 0xffffff;

export type StripeLetterLayer = {
  container: Container;
  sync: (grid: BlockGrid | null) => void;
  applySparkle: (timeSec: number, options: PlaygroundSparkleOptions) => void;
  setVisible: (visible: boolean) => void;
  destroy: () => void;
};

export function createStripeLetterLayer(atlas: StripeLetterAtlas): StripeLetterLayer {
  const container = new Container();
  const sprites: Sprite[] = [];
  let placements: StripeLetterPlacement[] = [];

  const sync = (grid: BlockGrid | null) => {
    for (const sprite of sprites) {
      sprite.destroy();
    }
    sprites.length = 0;
    placements = [];
    container.removeChildren();

    if (!grid) {
      return;
    }

    placements = computeStripeLetterPlacements(grid);
    for (const placement of placements) {
      const glyph = atlas.get(placement.char);
      if (!glyph) {
        continue;
      }

      const sprite = new Sprite(glyph.texture);
      sprite.anchor.set(0.5);
      sprite.width = glyph.width;
      sprite.height = glyph.height;
      sprite.roundPixels = true;
      sprite.tint = STRIPE_LETTER_TINT;
      sprite.position.set(
        placement.col * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5,
        placement.row * STRIPE_CELL_SIZE + STRIPE_CELL_SIZE * 0.5,
      );
      sprites.push(sprite);
      container.addChild(sprite);
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
    container.destroy({ children: true });
  };

  return { container, sync, applySparkle, setVisible, destroy };
}
