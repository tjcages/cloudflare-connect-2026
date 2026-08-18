import {
  Components,
  createPlugin,
  useInputContext,
  type LevaInputProps,
} from "leva/plugin";
import { useEffect, useState } from "react";
import {
  CONNECT_HERO_RAIN_GLSL,
  RAIN_SHADER_ERROR_EVENT,
} from "../hero/rain-control-settings";

const { Row } = Components;

/**
 * GLSL editor for the rain's texture source. The Leva value is the applied
 * `mainImage` source; edits stay local until Apply so half-typed shaders never
 * hit the compiler. The worker reports each apply's compile result through
 * {@link RAIN_SHADER_ERROR_EVENT} — errors render inline and the previous
 * shader keeps running.
 */

type ShaderCodeSettings = Record<string, never>;

type ShaderCodeInput = {
  value: string;
};

type ShaderCodePluginProps = LevaInputProps<string, ShaderCodeSettings>;

function ShaderCodePluginComponent() {
  const { value, onUpdate } = useInputContext<ShaderCodePluginProps>();
  const applied = String(value);
  const [draft, setDraft] = useState(applied);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  useEffect(() => {
    const onResult = (event: Event) => {
      setError((event as CustomEvent<string | null>).detail);
    };
    window.addEventListener(RAIN_SHADER_ERROR_EVENT, onResult);
    return () => window.removeEventListener(RAIN_SHADER_ERROR_EVENT, onResult);
  }, []);

  const dirty = draft !== applied;

  return (
    <Row>
      <div className="connect-shader-code">
        <textarea
          aria-label="Shader source (mainImage GLSL)"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onUpdate(draft);
            }
          }}
          spellCheck={false}
          value={draft}
        />
        <div className="connect-shader-code__actions">
          <button
            disabled={!dirty}
            onClick={() => onUpdate(draft)}
            type="button"
          >
            Apply (⌘⏎)
          </button>
          <button
            onClick={() => onUpdate(CONNECT_HERO_RAIN_GLSL)}
            type="button"
          >
            Reset to Corridor
          </button>
        </div>
        {error ? (
          <pre className="connect-shader-code__error">{error}</pre>
        ) : null}
        <p className="connect-shader-code__hint">
          void mainImage(out vec4 O, in vec2 I) — uniforms: iTime, iResolution,
          iMouse, iChannel0–3
        </p>
      </div>
    </Row>
  );
}

export const shaderCodePlugin = createPlugin<
  ShaderCodeInput,
  string,
  ShaderCodeSettings
>({
  component: ShaderCodePluginComponent,
  // Leva unwraps a `{ value }` custom input before calling normalize, so the
  // raw string arrives here directly — accept both shapes like the other
  // panel plugins do.
  normalize: (input) => {
    const record = input && typeof input === "object" ? input : null;
    const value = record && "value" in record ? record.value : input;
    return { value: typeof value === "string" ? value : "", settings: {} };
  },
  sanitize: (value) => String(value),
});
