CREATE TABLE shared_size_presets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  unit TEXT NOT NULL CHECK (unit IN ('pixels', 'inches')),
  width REAL NOT NULL CHECK (width > 0),
  height REAL NOT NULL CHECK (height > 0),
  ppi INTEGER NOT NULL CHECK (ppi BETWEEN 1 AND 1200),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX shared_size_presets_created_at_idx
  ON shared_size_presets (created_at DESC);
