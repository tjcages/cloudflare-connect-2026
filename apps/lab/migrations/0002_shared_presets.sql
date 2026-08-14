CREATE TABLE shared_presets (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('size', 'layout', 'style', 'color')),
  name TEXT NOT NULL COLLATE NOCASE,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  schema_version INTEGER NOT NULL CHECK (
    (kind = 'layout' AND schema_version = 2)
    OR (kind IN ('size', 'style', 'color') AND schema_version = 1)
  ),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, name)
);

CREATE INDEX shared_presets_updated_at_idx
  ON shared_presets (updated_at DESC);

INSERT INTO shared_presets (
  id,
  kind,
  name,
  payload_json,
  schema_version,
  revision,
  created_at,
  updated_at
)
SELECT
  id,
  'size',
  name,
  json_object('unit', unit, 'width', width, 'height', height, 'ppi', ppi),
  1,
  1,
  created_at,
  updated_at
FROM shared_size_presets;
