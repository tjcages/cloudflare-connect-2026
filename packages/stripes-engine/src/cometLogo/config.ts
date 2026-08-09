export type CometLogoSettings = {
  version: number;
  fieldSpeed: number;
  fieldDepth: number;
  fieldSpread: number;
  centerClearRadius: number;
  centerClearAspect: number;
  centerClearSquareness: number;
  centerClearLeak: number;
  centerClearFalloff: number;
  fieldAlign: number;
  formationDirectness: number;
  formationMaxTravel: number;
  formationEase: number;
  formationWiggle: number;
  formationInterrupt: number;
  fieldTrailLength: number;
  fieldParticleSize: number;
  logoScale: number;
  logoParticleSize: number;
  logoDensity: number;
  logoTrailLength: number;
  logoMotion: number;
  formationDuration: number;
  rejoinDuration: number;
  formationRejoinScale: number;
  formationStagger: number;
  centerPreference: number;
  sparkFrequency: number;
  sparkSize: number;
  sparkBrightness: number;
  sparkTrailLength: number;
  burstProbability: number;
  waveProbability: number;
  surfaceEffects: number;
  fireScale: number;
  fireIntensity: number;
  fireSpeed: number;
  fireTurbulence: number;
  flameHeight: number;
  weatherSpeed: number;
  weatherVariation: number;
  coronaMist: number;
  curlingWisps: number;
  hotRim: number;
  eruptionFrequency: number;
  eruptionScale: number;
  eruptionIntensity: number;
  eruptionParticles: number;
  eruptionCycleSpeed: number;
};

export const COMET_LOGO_CONFIG_VERSION = 3;

export const COMET_LOGO_DEFAULTS: CometLogoSettings = {
  version: COMET_LOGO_CONFIG_VERSION,
  fieldSpeed: 1.62,
  fieldDepth: 6.51,
  fieldSpread: 2.18,
  centerClearRadius: 200,
  centerClearAspect: 1,
  centerClearSquareness: 2,
  centerClearLeak: 0,
  centerClearFalloff: 1,
  fieldAlign: 0,
  formationDirectness: 0,
  formationMaxTravel: 0,
  formationEase: 0,
  formationWiggle: 0,
  formationInterrupt: 2,
  fieldTrailLength: 1,
  fieldParticleSize: 1,
  logoScale: 0.85,
  logoParticleSize: 1,
  logoDensity: 1,
  logoTrailLength: 1,
  logoMotion: 1,
  formationDuration: 1.1,
  rejoinDuration: 1.1,
  formationRejoinScale: 1.18,
  formationStagger: 0.1,
  centerPreference: 0.78,
  sparkFrequency: 1,
  sparkSize: 1,
  sparkBrightness: 1,
  sparkTrailLength: 1,
  burstProbability: 0.62,
  waveProbability: 0.28,
  surfaceEffects: 1,
  fireScale: 1,
  fireIntensity: 1,
  fireSpeed: 1,
  fireTurbulence: 1,
  flameHeight: 1,
  weatherSpeed: 1,
  weatherVariation: 1,
  coronaMist: 1,
  curlingWisps: 1,
  hotRim: 1,
  eruptionFrequency: 0.08,
  eruptionScale: 1,
  eruptionIntensity: 1,
  eruptionParticles: 1,
  eruptionCycleSpeed: 1,
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function normalizeCometLogoSettings(value: unknown): CometLogoSettings {
  const input = value && typeof value === "object" ? (value as Partial<CometLogoSettings>) : {};
  const formationDuration =
    input.version !== COMET_LOGO_CONFIG_VERSION && input.formationDuration === 1.8
      ? COMET_LOGO_DEFAULTS.formationDuration
      : input.formationDuration;
  return {
    version: COMET_LOGO_CONFIG_VERSION,
    fieldSpeed: clamp(input.fieldSpeed, COMET_LOGO_DEFAULTS.fieldSpeed, 0, 4),
    fieldDepth: clamp(input.fieldDepth, COMET_LOGO_DEFAULTS.fieldDepth, 2, 12),
    fieldSpread: clamp(input.fieldSpread, COMET_LOGO_DEFAULTS.fieldSpread, 0.5, 5),
    centerClearRadius: clamp(input.centerClearRadius, COMET_LOGO_DEFAULTS.centerClearRadius, 0, 400),
    centerClearAspect: clamp(input.centerClearAspect, COMET_LOGO_DEFAULTS.centerClearAspect, 0.25, 4),
    centerClearSquareness: clamp(input.centerClearSquareness, COMET_LOGO_DEFAULTS.centerClearSquareness, 2, 12),
    centerClearLeak: clamp(input.centerClearLeak, COMET_LOGO_DEFAULTS.centerClearLeak, 0, 0.5),
    centerClearFalloff: clamp(input.centerClearFalloff, COMET_LOGO_DEFAULTS.centerClearFalloff, 0.05, 8),
    fieldAlign: clamp(input.fieldAlign, COMET_LOGO_DEFAULTS.fieldAlign, 0, 1),
    formationDirectness: clamp(input.formationDirectness, COMET_LOGO_DEFAULTS.formationDirectness, 0, 1),
    formationMaxTravel: clamp(input.formationMaxTravel, COMET_LOGO_DEFAULTS.formationMaxTravel, 0, 8),
    formationEase: clamp(input.formationEase, COMET_LOGO_DEFAULTS.formationEase, 0, 4),
    formationWiggle: clamp(input.formationWiggle, COMET_LOGO_DEFAULTS.formationWiggle, 0, 3),
    formationInterrupt: clamp(input.formationInterrupt, COMET_LOGO_DEFAULTS.formationInterrupt, 0, 2),
    fieldTrailLength: clamp(input.fieldTrailLength, COMET_LOGO_DEFAULTS.fieldTrailLength, 0, 3),
    fieldParticleSize: clamp(input.fieldParticleSize, COMET_LOGO_DEFAULTS.fieldParticleSize, 0.25, 3),
    logoScale: clamp(input.logoScale, COMET_LOGO_DEFAULTS.logoScale, 0.35, 1.5),
    logoParticleSize: clamp(input.logoParticleSize, COMET_LOGO_DEFAULTS.logoParticleSize, 0.25, 3),
    logoDensity: clamp(input.logoDensity, COMET_LOGO_DEFAULTS.logoDensity, 1, 5),
    logoTrailLength: clamp(input.logoTrailLength, COMET_LOGO_DEFAULTS.logoTrailLength, 0, 3),
    logoMotion: clamp(input.logoMotion, COMET_LOGO_DEFAULTS.logoMotion, 0, 3),
    formationDuration: clamp(formationDuration, COMET_LOGO_DEFAULTS.formationDuration, 0.2, 6),
    rejoinDuration: clamp(input.rejoinDuration, COMET_LOGO_DEFAULTS.rejoinDuration, 0.2, 6),
    formationRejoinScale: clamp(input.formationRejoinScale, COMET_LOGO_DEFAULTS.formationRejoinScale, 0.2, 2),
    formationStagger: clamp(input.formationStagger, COMET_LOGO_DEFAULTS.formationStagger, 0, 0.9),
    centerPreference: clamp(input.centerPreference, COMET_LOGO_DEFAULTS.centerPreference, 0, 1),
    sparkFrequency: clamp(input.sparkFrequency, COMET_LOGO_DEFAULTS.sparkFrequency, 0.1, 4),
    sparkSize: clamp(input.sparkSize, COMET_LOGO_DEFAULTS.sparkSize, 0.2, 3),
    sparkBrightness: clamp(input.sparkBrightness, COMET_LOGO_DEFAULTS.sparkBrightness, 0, 3),
    sparkTrailLength: clamp(input.sparkTrailLength, COMET_LOGO_DEFAULTS.sparkTrailLength, 0, 3),
    burstProbability: clamp(input.burstProbability, COMET_LOGO_DEFAULTS.burstProbability, 0, 1),
    waveProbability: clamp(input.waveProbability, COMET_LOGO_DEFAULTS.waveProbability, 0, 1),
    surfaceEffects: clamp(input.surfaceEffects, COMET_LOGO_DEFAULTS.surfaceEffects, 0, 3),
    fireScale: clamp(input.fireScale, COMET_LOGO_DEFAULTS.fireScale, 0.25, 3),
    fireIntensity: clamp(input.fireIntensity, COMET_LOGO_DEFAULTS.fireIntensity, 0, 3),
    fireSpeed: clamp(input.fireSpeed, COMET_LOGO_DEFAULTS.fireSpeed, 0, 3),
    fireTurbulence: clamp(input.fireTurbulence, COMET_LOGO_DEFAULTS.fireTurbulence, 0, 3),
    flameHeight: clamp(input.flameHeight, COMET_LOGO_DEFAULTS.flameHeight, 0.2, 3),
    weatherSpeed: clamp(input.weatherSpeed, COMET_LOGO_DEFAULTS.weatherSpeed, 0, 3),
    weatherVariation: clamp(input.weatherVariation, COMET_LOGO_DEFAULTS.weatherVariation, 0, 2),
    coronaMist: clamp(input.coronaMist, COMET_LOGO_DEFAULTS.coronaMist, 0, 3),
    curlingWisps: clamp(input.curlingWisps, COMET_LOGO_DEFAULTS.curlingWisps, 0, 3),
    hotRim: clamp(input.hotRim, COMET_LOGO_DEFAULTS.hotRim, 0, 3),
    eruptionFrequency: clamp(input.eruptionFrequency, COMET_LOGO_DEFAULTS.eruptionFrequency, 0, 1),
    eruptionScale: clamp(input.eruptionScale, COMET_LOGO_DEFAULTS.eruptionScale, 0.2, 3),
    eruptionIntensity: clamp(input.eruptionIntensity, COMET_LOGO_DEFAULTS.eruptionIntensity, 0, 3),
    eruptionParticles: clamp(input.eruptionParticles, COMET_LOGO_DEFAULTS.eruptionParticles, 0, 3),
    eruptionCycleSpeed: clamp(input.eruptionCycleSpeed, COMET_LOGO_DEFAULTS.eruptionCycleSpeed, 0.1, 4),
  };
}
