// Constant DDL matching test/fixtures/schema-pg.ts. Keep in sync by hand.
export const DDL_PG = `
CREATE TYPE role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE mood AS ENUM ('calm', 'busy');
CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  role role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  published_at TIMESTAMP,
  meta JSONB,
  views INTEGER,
  score REAL,
  big BIGINT
);
CREATE TABLE kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  day DATE NOT NULL,
  code UUID NOT NULL DEFAULT gen_random_uuid(),
  amount NUMERIC,
  mood mood,
  note TEXT,
  due DATE
);
CREATE TABLE tags (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  label VARCHAR(50) NOT NULL,
  description TEXT
);
`;
