-- VibeGuide index schema §503-522
-- Initial schema version 1

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  git_oid TEXT NOT NULL,
  language TEXT,
  lines INTEGER,
  last_indexed_at INTEGER
);

CREATE TABLE IF NOT EXISTS imports (
  from_file TEXT NOT NULL,
  to_file TEXT NOT NULL,
  specifier TEXT,
  FOREIGN KEY (from_file) REFERENCES files(path) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exports (
  file TEXT NOT NULL,
  symbol TEXT NOT NULL,
  kind TEXT,
  line INTEGER,
  FOREIGN KEY (file) REFERENCES files(path) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS symbols (
  file TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT,
  line INTEGER,
  scope TEXT,
  FOREIGN KEY (file) REFERENCES files(path) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ownership (
  file TEXT NOT NULL,
  author TEXT NOT NULL,
  commits INTEGER,
  last_touch INTEGER,
  FOREIGN KEY (file) REFERENCES files(path) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commits (
  sha TEXT PRIMARY KEY,
  author TEXT,
  message TEXT,
  timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS embeddings (
  file TEXT NOT NULL,
  chunk_id INTEGER NOT NULL,
  vector BLOB,
  FOREIGN KEY (file) REFERENCES files(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_imports_to ON imports(to_file);
CREATE INDEX IF NOT EXISTS idx_imports_from ON imports(from_file);
CREATE INDEX IF NOT EXISTS idx_exports_file ON exports(file);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file);
CREATE INDEX IF NOT EXISTS idx_ownership_file ON ownership(file);
CREATE INDEX IF NOT EXISTS idx_commits_time ON commits(timestamp);
