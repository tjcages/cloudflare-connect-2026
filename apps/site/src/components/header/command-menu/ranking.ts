import type {
  CommandMenuGroup,
  CommandMenuItemKind,
  CommandMenuSearchRecord,
} from "./types";

const maxResults = 10;
const navigationLimit = 3;
const caseStudyLimit = 2;

const dedupeKey = (href: string) => {
  try {
    const url = new URL(href);
    if (url.hostname !== "blog.cloudflare.com") return href;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.href;
  } catch {
    return href;
  }
};

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const words = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const isSubsequence = (needle: string, haystack: string) => {
  if (needle.length < 3) return false;

  let position = 0;
  for (const character of haystack) {
    if (character === needle[position]) position += 1;
    if (position === needle.length) return true;
  }
  return false;
};

const tokenScore = (field: string, token: string) => {
  const fieldWords = words(field);
  if (fieldWords.includes(token)) return 120;
  if (fieldWords.some((word) => word.startsWith(token))) return 90;
  if (normalize(field).includes(token)) return 60;
  if (fieldWords.some((word) => isSubsequence(token, word))) return 30;
  return 0;
};

const scoreRecord = (record: CommandMenuSearchRecord, query: string) => {
  const normalizedQuery = normalize(query);
  const tokens = words(query);
  const fields = [
    { value: record.label, weight: 8 },
    { value: record.groupLabel, weight: 4 },
    ...record.keywords.map((value) => ({ value, weight: 5 })),
    { value: record.description, weight: 2 },
  ];

  if (
    tokens.some(
      (token) => !fields.some((field) => tokenScore(field.value, token) > 0)
    )
  ) {
    return null;
  }

  let score = 0;
  const label = normalize(record.label);
  if (label === normalizedQuery) score += 10_000;
  else if (label.startsWith(normalizedQuery)) score += 6_000;
  else if (label.includes(normalizedQuery)) score += 3_000;

  for (const token of tokens) {
    score += Math.max(
      ...fields.map((field) => tokenScore(field.value, token) * field.weight)
    );
  }

  return score;
};

type ScoredRecord = {
  record: CommandMenuSearchRecord;
  score: number;
  sourceIndex: number;
};

const compareRecords = (left: ScoredRecord, right: ScoredRecord) =>
  right.score - left.score ||
  (right.record.publishedAt ?? "").localeCompare(
    left.record.publishedAt ?? ""
  ) ||
  left.sourceIndex - right.sourceIndex;

const takeByKind = (
  records: ScoredRecord[],
  kinds: CommandMenuItemKind[],
  limit: number
) =>
  records.filter(({ record }) => kinds.includes(record.kind)).slice(0, limit);

export function searchCommandMenuRecords(
  records: readonly CommandMenuSearchRecord[],
  query: string
): CommandMenuGroup[] {
  if (!normalize(query)) return [];

  const seenUrls = new Set<string>();
  const matches = records
    .map((record, sourceIndex): ScoredRecord | null => {
      const score = scoreRecord(record, query);
      return score === null ? null : { record, score, sourceIndex };
    })
    .filter((entry): entry is ScoredRecord => entry !== null)
    .sort(compareRecords)
    .filter(({ record }) => {
      const key = dedupeKey(record.href);
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });

  const navigation = takeByKind(matches, ["page", "product"], navigationLimit);
  const caseStudies = takeByKind(matches, ["case-study"], caseStudyLimit);
  const selectedIds = new Set(
    [...navigation, ...caseStudies].map(({ record }) => record.id)
  );
  const remaining = matches.filter(({ record }) => !selectedIds.has(record.id));
  const posts = takeByKind(
    remaining,
    ["post"],
    maxResults - navigation.length - caseStudies.length
  );
  const selected = [...navigation, ...caseStudies, ...posts];

  if (selected.length < maxResults) {
    const selectedHrefs = new Set(selected.map(({ record }) => record.href));
    selected.push(
      ...remaining
        .filter(({ record }) => !selectedHrefs.has(record.href))
        .slice(0, maxResults - selected.length)
    );
  }

  const groups = new Map<
    string,
    CommandMenuGroup & { order: number; firstIndex: number }
  >();

  for (const [index, { record }] of selected.entries()) {
    const group = groups.get(record.groupId) ?? {
      id: record.groupId,
      label: record.groupLabel,
      items: [],
      order: record.groupOrder,
      firstIndex: index,
    };
    group.items.push(record);
    groups.set(record.groupId, group);
  }

  return [...groups.values()]
    .sort(
      (left, right) =>
        left.order - right.order || left.firstIndex - right.firstIndex
    )
    .map(({ id, label, items }) => ({ id, label, items }));
}
