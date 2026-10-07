// Constant DDL matching test/fixtures/schema-sqlite.ts. Keep in sync by hand.
export const DDL_SQLITE = `
CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  published_at INTEGER,
  meta TEXT,
  views INTEGER,
  score REAL,
  big BLOB
);
CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;
