export default function BadgeShaderSource({ src }: { src: string }) {
  return (
    <figure className="rounded-8 bg-background-base p-8 shadow-elevation-default">
      <figcaption className="mb-8 text-label-x-small text-text-muted">
        Shader source
      </figcaption>
      <img
        alt="Luminance plate converted into the badge stripe shader"
        className="h-80 w-200 rounded-8 bg-black object-contain"
        src={src}
      />
    </figure>
  );
}
