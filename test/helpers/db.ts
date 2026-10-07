import { PGlite } from "@electric-sql/pglite";
import Database from "better-sqlite3";
import type { Logger, Table } from "drizzle-orm";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/pglite";
import type { Dialect } from "../../src/introspect/index.js";
import { DDL_PG } from "../fixtures/ddl-pg.sql.js";
import { DDL_SQLITE } from "../fixtures/ddl-sqlite.sql.js";
import * as pgSchema from "../fixtures/schema-pg.js";
import * as sqliteSchema from "../fixtures/schema-sqlite.js";

/** Tables every fixture schema exports; `events` exists on PG only. */
export type FixtureSchema = { authors: Table; articles: Table; kv: Table; events?: Table };

export type SetupResult = {
  db: unknown;
  schema: FixtureSchema;
  close(): Promise<void>;
  /** Queries issued through `db` since setup finished (fixture inserts are not counted). */
  queryCount(): number;
};

export type DialectFixture = {
  name: "sqlite" | "pglite";
  dialect: Dialect;
  setup(opts?: { logger?: Logger }): Promise<SetupResult>;
};

const at = (iso: string) => new Date(iso);

const AUTHORS = [
  {
    name: "alice",
    email: "alice@example.com",
    active: true,
    role: "admin",
    createdAt: at("2026-01-01T00:00:00Z"),
  },
  {
    name: "bob",
    email: "bob@example.com",
    active: true,
    role: "editor",
    createdAt: at("2026-02-01T00:00:00Z"),
  },
  {
    name: "carol",
    email: null,
    active: false,
    role: "viewer",
    createdAt: at("2026-03-01T00:00:00Z"),
  },
  {
    name: "dave",
    email: "dave@example.com",
    active: true,
    role: "viewer",
    createdAt: at("2026-04-01T00:00:00Z"),
  },
] as const;

// Author ids are 1..4 (insertion order). Titles 4 to 7 exercise LIKE wildcard escaping.
const ARTICLES = [
  { title: "Alpha", authorId: 1, publishedAt: at("2026-10-07T00:00:00Z"), views: 10, big: 10n },
  { title: "Beta", authorId: 1, publishedAt: at("2026-10-05T00:00:00Z"), views: 20, big: 9n },
  { title: "Gamma", authorId: 2, publishedAt: at("2026-09-01T00:00:00Z"), views: 30, big: null },
  { title: "Rate 100% done", authorId: 2, publishedAt: null, views: 40, big: null },
  { title: "Rate 100 done", authorId: 3, publishedAt: null, views: 50, big: null },
  { title: "snake_case", authorId: 4, publishedAt: null, views: 60, big: null },
  { title: "snakeXcase", authorId: 4, publishedAt: null, views: 70, big: null },
] as const;

const KV = [
  { key: "a", value: "one" },
  { key: "b", value: "two" },
  { key: "c", value: "three" },
] as const;

// For `now` = 2026-10-06T16:00Z in Asia/Tokyo (calendar date 2026-10-07; UTC date 2026-10-06).
const EVENTS = [
  {
    day: at("2026-10-06T00:00:00Z"),
    due: "2026-10-06",
    code: "a1b2c3d4-0000-4000-8000-000000000001",
    amount: "12.50",
    mood: "calm",
    note: "previous day",
  },
  {
    day: at("2026-10-07T00:00:00Z"),
    due: "2026-10-07",
    code: "a1b2c3d4-0000-4000-8000-000000000002",
    amount: "99.95",
    mood: "busy",
    note: "today",
  },
  {
    day: at("2026-10-08T00:00:00Z"),
    due: "2026-10-08",
    code: "a1b2c3d4-0000-4000-8000-000000000003",
    amount: null,
    mood: null,
    note: "next day",
  },
  {
    day: at("2026-10-07T00:00:00Z"),
    due: null,
    code: "a1b2c3d4-0000-4000-8000-000000000004",
    amount: null,
    mood: null,
    note: "today, no due",
  },
] as const;

// Counting starts only after seeding, so tests can assert exact per-call query counts. A caller's
// logger still sees every query it asked to observe, seeding included.
function makeLogger(user: Logger | undefined) {
  let n = 0;
  let live = false;
  const logger: Logger = {
    logQuery(query, params) {
      if (live) n++;
      user?.logQuery(query, params);
    },
  };
  return {
    logger,
    start: () => {
      live = true;
    },
    count: () => n,
  };
}

async function setupSqlite(opts?: { logger?: Logger }): Promise<SetupResult> {
  const client = new Database(":memory:");
  client.pragma("foreign_keys = ON");
  client.exec(DDL_SQLITE);
  const counter = makeLogger(opts?.logger);
  const db = drizzleSqlite(client, { logger: counter.logger });
  await db.insert(sqliteSchema.authors).values([...AUTHORS]);
  await db.insert(sqliteSchema.articles).values([...ARTICLES]);
  await db.insert(sqliteSchema.kv).values([...KV]);
  counter.start();
  return {
    db,
    schema: sqliteSchema,
    close: async () => void client.close(),
    queryCount: counter.count,
  };
}

async function setupPglite(opts?: { logger?: Logger }): Promise<SetupResult> {
  const client = new PGlite();
  await client.exec(DDL_PG);
  const counter = makeLogger(opts?.logger);
  const db = drizzlePg(client, { logger: counter.logger });
  await db.insert(pgSchema.authors).values([...AUTHORS]);
  await db.insert(pgSchema.articles).values([...ARTICLES]);
  await db.insert(pgSchema.kv).values([...KV]);
  await db.insert(pgSchema.events).values([...EVENTS]);
  counter.start();
  return {
    db,
    schema: pgSchema,
    close: () => client.close(),
    queryCount: counter.count,
  };
}

export const dialects: DialectFixture[] = [
  { name: "sqlite", dialect: "sqlite", setup: setupSqlite },
  { name: "pglite", dialect: "postgres", setup: setupPglite },
];
