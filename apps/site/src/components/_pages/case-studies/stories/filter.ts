import {
  industryOptions,
  regionOptions,
  type Story,
  type StoryFacetKey,
  useCaseOptions,
} from "./data";

export type StoryFilters = Record<StoryFacetKey, string[]>;

export const emptyFilters: StoryFilters = {
  region: [],
  industry: [],
  product: [],
  useCase: [],
};

function facetValues(story: Story, facet: StoryFacetKey): string[] {
  if (facet === "region") {
    return [story.region];
  }
  if (facet === "industry") {
    return [story.industry];
  }
  if (facet === "product") {
    return story.products;
  }
  return story.useCases;
}

export function filterStories(
  stories: Story[],
  filters: StoryFilters
): Story[] {
  return stories.filter((story) =>
    (Object.keys(filters) as StoryFacetKey[]).every((facet) => {
      const selected = filters[facet];
      if (selected.length === 0) {
        return true;
      }
      return facetValues(story, facet).some((value) =>
        selected.includes(value)
      );
    })
  );
}

export function facetOptions(stories: Story[], facet: StoryFacetKey): string[] {
  if (facet === "region") {
    return [...regionOptions];
  }
  if (facet === "industry") {
    return [...industryOptions];
  }
  if (facet === "useCase") {
    return [...useCaseOptions];
  }

  const options = new Set<string>();
  for (const story of stories) {
    for (const value of story.products) {
      options.add(value);
    }
  }
  return [...options];
}

export function toggleFacetValue(
  filters: StoryFilters,
  facet: StoryFacetKey,
  value: string
): StoryFilters {
  const selected = filters[facet];

  return {
    ...filters,
    [facet]: selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value],
  };
}
