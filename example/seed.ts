import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { posts, tags, users } from "./schema.js";

/** Constant DDL matching schema.ts; column names are the property names (no explicit names). */
export function createSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      authorId INTEGER NOT NULL REFERENCES users(id),
      publishedAt INTEGER,
      metadata TEXT
    );
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);
}

const DAY_MS = 24 * 60 * 60 * 1000;

const USERS = [
  { email: "alice@example.com", name: "Alice Admin", role: "admin", isActive: true, ageDays: 90 },
  { email: "bob@example.com", name: "Bob Editor", role: "editor", isActive: true, ageDays: 60 },
  { email: "carol@example.com", name: "Carol Editor", role: "editor", isActive: true, ageDays: 30 },
  { email: "dave@example.com", name: "Dave Viewer", role: "viewer", isActive: false, ageDays: 10 },
  { email: "erin@example.com", name: "Erin Viewer", role: "viewer", isActive: true, ageDays: 0 },
] as const;

const TAGS = ["news", "tutorial", "release", "opinion", "howto", "faq", "meta", "misc"];

/** Deterministic (no randomness); dates are relative to the time of the call so filters show data. */
export async function seed(db: BetterSQLite3Database): Promise<void> {
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * DAY_MS);

  // How many days before "now" each published post went out: today, within the past 7 days,
  // earlier this month and well before that, so every date filter has matches.
  // The "earlier this month" age is clamped so that it stays in the current month early on.
  const publishAgesDays = [0, 2, 5, Math.min(12, new Date(now).getDate() - 1), 40, 75];

  const inserted = await db
    .insert(users)
    .values(USERS.map(({ ageDays, ...user }) => ({ ...user, createdAt: ago(ageDays) })))
    .returning({ id: users.id });
  const authorIds = inserted.map((row) => row.id);

  await db.insert(tags).values(TAGS.map((name) => ({ name })));

  // Indexed by a counter of published posts: indexing by `i` would line the ages up with the
  // draft pattern (`i % 3`) and leave some ages (e.g. today) only on drafts.
  let publishedCount = 0;
  await db.insert(posts).values(
    Array.from({ length: 60 }, (_, i) => {
      const published = i % 3 !== 0;
      return {
        title: `Post ${i + 1}: ${TAGS[i % TAGS.length]} notes`,
        body: i % 5 === 0 ? null : `Body text of post ${i + 1}.`,
        status: published ? ("published" as const) : ("draft" as const),
        authorId: authorIds[i % authorIds.length] as number,
        publishedAt: published
          ? ago(publishAgesDays[publishedCount++ % publishAgesDays.length] as number)
          : null,
        metadata: i % 4 === 0 ? { featured: true, rank: i } : null,
      };
    }),
  );
}
