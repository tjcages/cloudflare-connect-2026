import type {
  DeleteResult,
  MutationResult,
  SharedPreset,
  SharedPresetCreateInput,
  SharedPresetKind,
  SharedPresetStore,
  SharedPresetUpdateInput,
} from "./sharedPresetApi";

type SharedPresetRow = {
  id: string;
  kind: SharedPresetKind;
  name: string;
  payload_json: string;
  schema_version: number;
  revision: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, kind, name, payload_json, schema_version, revision, created_by, created_at, updated_at";

function fromRow(row: SharedPresetRow): SharedPreset {
  const preset: SharedPreset = {
    id: row.id,
    kind: row.kind,
    name: row.name,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    schemaVersion: row.schema_version,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.created_by) preset.createdBy = row.created_by;
  return preset;
}

export class D1SharedPresetStore implements SharedPresetStore {
  constructor(
    private readonly database: D1Database,
    private readonly createdBy: string | null = null,
  ) {}

  async list(kind: SharedPresetKind | null): Promise<SharedPreset[]> {
    const statement = kind
      ? this.database
          .prepare(`SELECT ${COLUMNS} FROM shared_presets WHERE kind = ?1 ORDER BY name COLLATE NOCASE ASC`)
          .bind(kind)
      : this.database.prepare(`SELECT ${COLUMNS} FROM shared_presets ORDER BY kind ASC, name COLLATE NOCASE ASC`);
    const result = await statement.all<SharedPresetRow>();
    return result.results.map(fromRow);
  }

  async get(id: string): Promise<SharedPreset | null> {
    const row = await this.database
      .prepare(`SELECT ${COLUMNS} FROM shared_presets WHERE id = ?1`)
      .bind(id)
      .first<SharedPresetRow>();
    return row ? fromRow(row) : null;
  }

  async create(id: string, input: SharedPresetCreateInput): Promise<SharedPreset> {
    const row = await this.database
      .prepare(
        `INSERT INTO shared_presets (id, kind, name, payload_json, schema_version, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         RETURNING ${COLUMNS}`,
      )
      .bind(id, input.kind, input.name, JSON.stringify(input.payload), input.schemaVersion, this.createdBy)
      .first<SharedPresetRow>();
    if (!row) throw new Error("D1 did not return the created shared preset.");
    return fromRow(row);
  }

  async update(id: string, input: SharedPresetUpdateInput): Promise<MutationResult> {
    const row = await this.database
      .prepare(
        `UPDATE shared_presets
         SET name = ?1, payload_json = ?2, schema_version = ?3,
             revision = revision + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?4 AND revision = ?5
         RETURNING ${COLUMNS}`,
      )
      .bind(input.name, JSON.stringify(input.payload), input.schemaVersion, id, input.expectedRevision)
      .first<SharedPresetRow>();
    if (row) return { status: "ok", preset: fromRow(row) };
    const currentRevision = await this.database
      .prepare("SELECT revision FROM shared_presets WHERE id = ?1")
      .bind(id)
      .first<number>("revision");
    return currentRevision === null ? { status: "not_found" } : { status: "conflict" };
  }

  async delete(id: string, expectedRevision: number): Promise<DeleteResult> {
    const result = await this.database
      .prepare("DELETE FROM shared_presets WHERE id = ?1 AND revision = ?2")
      .bind(id, expectedRevision)
      .run();
    if (result.meta.changes > 0) return "deleted";
    const exists = await this.database
      .prepare("SELECT 1 AS present FROM shared_presets WHERE id = ?1")
      .bind(id)
      .first<number>("present");
    return exists === null ? "not_found" : "conflict";
  }
}
