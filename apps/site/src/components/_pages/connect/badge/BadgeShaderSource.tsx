import { BADGE_PRINT_FIELD_SRC } from "./badge-logo";

export default function BadgeShaderSource() {
  return (
    <figure className="flex flex-col gap-8">
      <figcaption className="text-label-x-small text-text-muted">
        Shader source
      </figcaption>
      <img
        alt="Luminance plate converted into the badge stripe shader"
        className="h-180 w-120 rounded-8 bg-black object-cover"
        src={BADGE_PRINT_FIELD_SRC}
      />
    </figure>
  );
}
