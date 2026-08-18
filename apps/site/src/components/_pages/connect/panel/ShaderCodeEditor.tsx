import { useEffect, useState } from "react";
import {
  CONNECT_HERO_RAIN_GLSL,
  RAIN_SHADER_ERROR_EVENT,
} from "../hero/rain-control-settings";
import {
  findRainShaderEntry,
  matchRainShaderEntry,
  RAIN_SHADER_LIBRARY,
} from "../hero/rain-shader-library";
import "./ShaderCodeEditor.css";

/**
 * GLSL editor for the rain's texture source, rendered as a custom field inside
 * the panel. `value` is the applied `mainImage` source; edits stay local until
 * Apply so half-typed shaders never hit the compiler. The preset select
 * carries the lab's shader library — picking one applies it immediately, and
 * it reads "Custom" whenever the applied GLSL matches no library entry. The
 * worker reports each apply's compile result through
 * {@link RAIN_SHADER_ERROR_EVENT} — errors render inline and the previous
 * shader keeps running.
 */

const CUSTOM_PRESET_ID = "custom";

interface Props {
  value: string;
  onApply: (glsl: string) => void;
}

export function ShaderCodeEditor({ value, onApply }: Props) {
  const applied = value;
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
  const presetId = matchRainShaderEntry(applied)?.id ?? CUSTOM_PRESET_ID;

  return (
    <div className="connect-shader-code">
      <label className="connect-shader-code__preset">
        <span>Preset</span>
        <select
          onChange={(event) => {
            const entry = findRainShaderEntry(event.target.value);
            if (entry) onApply(entry.source);
          }}
          value={presetId}
        >
          {presetId === CUSTOM_PRESET_ID ? (
            <option disabled value={CUSTOM_PRESET_ID}>
              Custom
            </option>
          ) : null}
          {RAIN_SHADER_LIBRARY.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <textarea
        aria-label="Shader source (mainImage GLSL)"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onApply(draft);
          }
        }}
        spellCheck={false}
        value={draft}
      />
      <div className="connect-shader-code__actions">
        <button disabled={!dirty} onClick={() => onApply(draft)} type="button">
          Apply (⌘⏎)
        </button>
        <button onClick={() => onApply(CONNECT_HERO_RAIN_GLSL)} type="button">
          Reset to default
        </button>
      </div>
      {error ? <pre className="connect-shader-code__error">{error}</pre> : null}
      <p className="connect-shader-code__hint">
        void mainImage(out vec4 O, in vec2 I) — uniforms: iTime, iResolution,
        iMouse, iChannel0–3
      </p>
    </div>
  );
}
