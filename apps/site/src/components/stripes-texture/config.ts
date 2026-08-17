import type {
  DeepPartial,
  EngineConfig,
  ThemedEngineConfig,
} from "@necatikcl/stripes-engine";

export type StripesTextureConfig = DeepPartial<EngineConfig> & {
  dark?: DeepPartial<EngineConfig>;
};

export const asThemedEngineConfig = (
  config: StripesTextureConfig
): ThemedEngineConfig => config as unknown as ThemedEngineConfig;
