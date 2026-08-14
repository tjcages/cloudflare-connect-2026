import type { SharedSizePreset, SharedSizePresetInput } from "../src/sharedSizePresets";
import { D1SharedPresetStore } from "./d1SharedPresetStore";
import type { SharedPreset } from "./sharedPresetApi";
import type { SharedSizePresetStore } from "./sharedSizePresetApi";

function fromSharedPreset(preset: SharedPreset): SharedSizePreset {
  if (preset.kind !== "size") throw new Error("Expected a shared size preset.");
  const { unit, width, height, ppi } = preset.payload;
  if (
    (unit !== "pixels" && unit !== "inches") ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    typeof ppi !== "number"
  ) {
    throw new Error("Shared size preset has an invalid payload.");
  }
  return {
    id: preset.id,
    name: preset.name,
    unit,
    width,
    height,
    ppi,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  };
}

export class D1SharedSizePresetStore implements SharedSizePresetStore {
  private readonly presets: D1SharedPresetStore;

  constructor(database: D1Database) {
    this.presets = new D1SharedPresetStore(database);
  }

  async list(): Promise<SharedSizePreset[]> {
    return (await this.presets.list("size")).map(fromSharedPreset);
  }

  async create(id: string, input: SharedSizePresetInput): Promise<SharedSizePreset> {
    const preset = await this.presets.create(id, {
      kind: "size",
      name: input.name,
      payload: { unit: input.unit, width: input.width, height: input.height, ppi: input.ppi },
      schemaVersion: 1,
    });
    return fromSharedPreset(preset);
  }

  async delete(id: string): Promise<boolean> {
    const preset = await this.presets.get(id);
    if (!preset || preset.kind !== "size") return false;
    return (await this.presets.delete(id, preset.revision)) === "deleted";
  }
}
