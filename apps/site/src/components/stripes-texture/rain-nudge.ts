/**
 * Live (not Reset) starting values that pull the comet/footer stripe variants
 * slightly toward the agenda/hero rain grid without rewriting those sections'
 * shipped defaults. Copy config later becomes the production bake.
 */
export const LOWER_PAGE_RAIN_NUDGE = {
  rainEnabled: true,
  gapsCoverage: 0,
  gapsSpeed: 1,
  gridCellWidth: 13,
  gridCellHeight: 15,
  gridGapX: 12,
  gridGapY: 0,
  gridAngle: 45,
  gridOverlap: 1.2,
  fieldScale: 0.25,
  sparkleWidthCoverage: 0.22,
  sparkleStripeCoverage: 0.12,
} as const;
