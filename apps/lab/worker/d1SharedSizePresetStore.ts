import type { SharedSizePreset, SharedSizePresetInput } from "../src/sharedSizePresets";
import type { SharedSizePresetStore } from "./sharedSizePresetApi";

type SharedSizePresetRow = {
  id: string;
  name: string;
  unit: SharedSizePreset["unit"];
  width: number;
  height: number;
  ppi: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, name, unit, width, height, ppi, created_at, updated_at";

function fromRow(row: SharedSizePresetRow): SharedSizePreset {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    width: row.width,
    height: row.height,
    ppi: row.ppi,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1SharedSizePresetStore implements SharedSizePresetStore {
  constructor(private readonly database: D1Database) {}

  async list(): Promise<SharedSizePreset[]> {
    const result = await this.database
      .prepare(`SELECT ${COLUMNS} FROM shared_size_presets ORDER BY name COLLATE NOCASE ASC`)
      .run<SharedSizePresetRow>();
    return result.results.map(fromRow);
  }

  async create(id: string, input: SharedSizePresetInput): Promise<SharedSizePreset> {
    const row = await this.database
      .prepare(
        `INSERT INTO shared_size_presets (id, name, unit, width, height, ppi)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         RETURNING ${COLUMNS}`,
      )
      .bind(id, input.name, input.unit, input.width, input.height, input.ppi)
      .first<SharedSizePresetRow>();
    if (!row) throw new Error("D1 did not return the created size preset.");
    return fromRow(row);
  }
}
