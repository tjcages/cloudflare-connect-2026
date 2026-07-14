import type { RenderTarget } from "../gl/renderTarget";
import type { VibrantColor } from "../colors/vibrantPalette";
import type { Pass } from "../pipeline/pipeline";

type ParticlePass<TParticle, TOpts> = {
  render(target: RenderTarget, particles: TParticle[], opts: TOpts): void;
  renderColors(
    field: RenderTarget,
    fieldColor: RenderTarget,
    particles: TParticle[],
    palette: VibrantColor[],
    opts: TOpts,
  ): void;
  dispose(): void;
};

export function createParticleFieldPass<TParticle, TOpts>(deps: {
  name: string;
  pass: ParticlePass<TParticle, TOpts>;
  colorsMode: boolean;
  step(): { particles: TParticle[]; opts: TOpts };
  getFieldRT(): RenderTarget;
  getFieldColorRT(): RenderTarget;
  getPalette(): VibrantColor[];
}): Pass {
  return {
    name: deps.name,
    render: () => {
      const { particles, opts } = deps.step();
      const fieldRT = deps.getFieldRT();
      if (deps.colorsMode) {
        deps.pass.renderColors(fieldRT, deps.getFieldColorRT(), particles, deps.getPalette(), opts);
      } else {
        deps.pass.render(fieldRT, particles, opts);
      }
    },
    dispose: () => deps.pass.dispose(),
  };
}
