import { Container } from "pixi.js";

const ALPHA_VISIBLE_PATCHED = Symbol.for("pixi:alpha-visible-patched");

export const implementAlphaVisible = () => {
  // must patch Container.prototype.alpha at most once — every Pixi island on
  // the page shares this prototype, so re-patching would nest N nested setters
  if (
    (Container.prototype as unknown as Record<symbol, unknown>)[
      ALPHA_VISIBLE_PATCHED
    ]
  )
    return;

  const descriptor = Object.getOwnPropertyDescriptor(
    Container.prototype,
    "alpha"
  );

  if (!descriptor) return;
  if (!descriptor.set) return;
  if (!descriptor.get) return;

  const originalSet = descriptor.set;

  Object.defineProperty(Container.prototype, "alpha", {
    get: descriptor.get,
    set(value: number) {
      originalSet.call(this, value);
      this.visible = this.alpha > 0;
    },
    configurable: true,
    enumerable: true,
  });

  (Container.prototype as unknown as Record<symbol, unknown>)[
    ALPHA_VISIBLE_PATCHED
  ] = true;
};
