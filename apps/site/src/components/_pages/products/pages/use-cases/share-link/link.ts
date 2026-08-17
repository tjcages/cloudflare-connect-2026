// Cloudflare seeds a new Worker with an `adjective-noun-hex` name, so the
// generated links follow that shape instead of a bare counter. Only the slug is
// regenerated; the domain never changes.
const ADJECTIVES = [
  "autumn",
  "bold",
  "calm",
  "cool",
  "crimson",
  "damp",
  "dawn",
  "divine",
  "gentle",
  "hidden",
  "icy",
  "late",
  "lively",
  "misty",
  "polished",
  "proud",
  "quiet",
  "restless",
  "silent",
  "snowy",
  "solar",
  "still",
  "twilight",
  "wandering",
  "wild",
  "wispy",
  "young",
];

const NOUNS = [
  "bird",
  "breeze",
  "brook",
  "cloud",
  "dew",
  "dust",
  "ember",
  "field",
  "fire",
  "frog",
  "frost",
  "glade",
  "haze",
  "leaf",
  "meadow",
  "moon",
  "paper",
  "pine",
  "pond",
  "rain",
  "sea",
  "sky",
  "smoke",
  "snow",
  "star",
  "sun",
  "surf",
  "tree",
  "voice",
  "wave",
  "wind",
  "wood",
];

export const INITIAL_SLUG = "wispy-frost-4f21";
export const URL_DOMAIN = ".r.workers.dev";

// The stage ticker owns the choreography, so it tells the island when the share
// lands rather than the island keeping a clock of its own.
export const SWAP_EVENT = "share-link:swap";

export function randomSlug(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  return `${adjective}-${noun}-${suffix}`;
}
