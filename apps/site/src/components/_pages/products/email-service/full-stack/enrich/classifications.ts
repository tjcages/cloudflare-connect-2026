import type { DuoIconName } from "@/components/icon/icons.gen";

export type Classification = { icon: DuoIconName; values: string[] };

// One icon per dimension, so a step's glyph names the question and its label
// answers it. Every name here is in DuoIconName — a mono icon would collapse to
// currentColor and lose the purple pair the hub is themed with.
export const CLASSIFICATIONS: Classification[] = [
  {
    icon: "archive",
    values: [
      "Support request",
      "Sales inquiry",
      "Bug report",
      "Feature request",
      "Billing",
      "Security",
      "Spam",
      "Feedback",
      "Partnership",
      "Job application",
    ],
  },
  {
    icon: "focus-exposure-2",
    values: [
      "Needs refund",
      "Needs help",
      "Reports bug",
      "Requests demo",
      "Requests quote",
      "Asks question",
      "Requests access",
    ],
  },
  {
    icon: "lightning-bolt",
    values: [
      "High priority",
      "Medium priority",
      "Low priority",
      "Urgent",
      "Critical",
    ],
  },
  {
    icon: "user",
    values: ["Positive", "Neutral", "Frustrated", "Angry", "Satisfied"],
  },
  {
    icon: "globe-3",
    values: ["English", "French", "German", "Spanish", "Japanese"],
  },
  {
    icon: "solution-security",
    values: ["Spam", "Likely spam", "Safe", "Trusted", "Phishing risk"],
  },
  {
    icon: "file-text",
    values: [
      "Invoice attached",
      "PDF attached",
      "Screenshot included",
      "Log file included",
      "Resume attached",
    ],
  },
];

export type ClassificationStep = { dimension: number; value: number };

export const STEPS_PER_PASS = 4;

const pick = (length: number) => Math.floor(Math.random() * length);

/**
 * Draws one pass: `STEPS_PER_PASS` distinct dimensions in their declared order,
 * each answered by a random value.
 *
 * Adjacent steps are kept from landing on the same string — "Spam" is both a
 * category and a spam verdict, and WordFade keys on the text, so a repeat would
 * swap the icon while the label sat dead.
 */
export function drawPass(): ClassificationStep[] {
  const pool = CLASSIFICATIONS.map((_, index) => index);
  const dimensions: number[] = [];
  for (let i = 0; i < STEPS_PER_PASS; i++) {
    dimensions.push(...pool.splice(pick(pool.length), 1));
  }
  dimensions.sort((a, b) => a - b);

  const steps: ClassificationStep[] = [];
  for (const dimension of dimensions) {
    const { values } = CLASSIFICATIONS[dimension];
    const previous = steps.at(-1);
    const spoken = previous
      ? CLASSIFICATIONS[previous.dimension].values[previous.value]
      : null;

    let value = pick(values.length);
    if (values[value] === spoken) value = (value + 1) % values.length;
    steps.push({ dimension, value });
  }
  return steps;
}
