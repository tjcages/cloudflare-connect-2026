import { Container } from "@/components/_animations/canvas2d/scene";
import { createAmbientTraffic } from "./create-ambient-traffic";
import { createSiteTraffic } from "./create-site-traffic";
import { createWireGlobe, type WireGlobeOptions } from "./create-wire-globe";

type GlobeTraffic = "ambient" | "sites";

type GlobeOptions = WireGlobeOptions & {
  traffic: GlobeTraffic;
};

type Globe = {
  container: Container;
  tick: (elapsed: number, dt: number) => void;
  resize: (width: number, height: number) => void;
  destroy: () => void;
};

export function createGlobe(
  width: number,
  height: number,
  { traffic, ...wireOptions }: GlobeOptions
): Globe {
  const container = new Container();
  const wire = createWireGlobe(width, height, wireOptions);
  const activity =
    traffic === "ambient"
      ? createAmbientTraffic(wire, height)
      : createSiteTraffic(wire, width);

  container.addChild(wire.container, activity.container);

  return {
    container,
    tick(elapsed, dt) {
      wire.advance(dt);
      activity.tick(elapsed);
    },
    resize(nextWidth, nextHeight) {
      wire.resize(nextWidth, nextHeight);
      activity.resize(nextWidth, nextHeight);
    },
    destroy() {
      container.removeChildren();
      activity.destroy();
      wire.destroy();
      container.destroy();
    },
  };
}
