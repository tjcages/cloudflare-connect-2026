const ORANGE_RED_HOTSPOT_HEXES = [
  "#fea700",
  "#f46021",
  "#f77720",
  "#e92e28",
  "#b33806",
  "#fa4541",
  "#ff8839",
  "#ff89a5",
  "#ffa05b",
  "#b0241f",
  "#ffbb7d",
  "#ff6967",
  "#8a2b01",
  "#ff9a96",
  "#ffb5b6",
  "#882426",
] as const;

export function nextOrangeRedLibraryHex(usedHexes: readonly string[]): string {
  const used = new Set(usedHexes.map((hex) => hex.toLowerCase()));
  return (
    ORANGE_RED_HOTSPOT_HEXES.find((hex) => !used.has(hex)) ??
    ORANGE_RED_HOTSPOT_HEXES[usedHexes.length % ORANGE_RED_HOTSPOT_HEXES.length] ??
    "#f46021"
  );
}
