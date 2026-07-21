import {
  compileProgram,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import type { ExperimentDefinition } from "./types";
import { LAVA_BLOBS_FRAG } from "./lava-blobs.shaders";
import { createLavaBlobsSim, MAX_BLOBS } from "./lava-blobs.sim";

const GHOST_WEIGHT = 0.08;
const SIM_SEED = 60217;

const definition: ExperimentDefinition = {
  id: "lava-blobs",
  title: "Lava Blobs",
  category: "ambience",
  blurb: "Metaball blobs rise buoyantly from a molten pool, merge, split, and dissolve near the top.",
  create: (ctx) => {
    const sim = createLavaBlobsSim(SIM_SEED);
    const blobData = new Float32Array(MAX_BLOBS * 4);

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, LAVA_BLOBS_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uBlobs = gl.getUniformLocation(program, "uBlobs");
      const uCount = gl.getUniformLocation(program, "uCount");
      const uAspect = gl.getUniformLocation(program, "uAspect");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uGhost = gl.getUniformLocation(program, "uGhost");

      return {
        render(frame) {
          const aspect = frame.cssW / Math.max(1, frame.cssH);
          sim.step(frame.now, aspect);
          const count = sim.writeBlobs(blobData);

          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform4fv(uBlobs, blobData);
          gl.uniform1i(uCount, count);
          gl.uniform1f(uAspect, aspect);
          gl.uniform1f(uTime, frame.elapsed / 1000);
          gl.uniform1f(uGhost, GHOST_WEIGHT);
          quad.draw();
        },
        dispose: () => gl.deleteProgram(program),
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      background: {
        ...DEFAULT_ENGINE_CONFIG.background,
        stars: { ...DEFAULT_ENGINE_CONFIG.background.stars, enabled: false },
      },
    });

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => sim.pulse(),
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
