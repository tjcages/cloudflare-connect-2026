type IconBoxPreviewProps = {
  cornerColor?: string;
  size?: "small" | "default";
};

export const IconBoxPreview = ({ cornerColor = "#F3F3F3", size = "default" }: IconBoxPreviewProps) => {
  const scale = size === "small" ? 0.5 : 1;

  return (
    <svg
      className={`icon-box-preview icon-box-preview-${size}`}
      width={80 * scale}
      height={80 * scale}
      viewBox="0 0 80 80"
      aria-hidden="true"
    >
      <rect
        x="8"
        y="8"
        width="64"
        height="64"
        rx="10"
        fill="#FFFFFF"
        stroke="rgba(0, 0, 0, 0.04)"
        filter="drop-shadow(0 6px 12px rgba(0, 0, 0, 0.04))"
      />
      {[
        [16, 16],
        [62, 16],
        [16, 62],
        [62, 62],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="2" height="2" rx="1" fill={cornerColor} />
      ))}
    </svg>
  );
};
