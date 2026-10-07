// The Drizzle boundary (decision 012): `AdminConfig.db` arrives as `unknown`, and this is the only
// place it is cast to a structural query-builder type.

// biome-ignore lint/suspicious/noExplicitAny: SQLite and PG builders share this call shape but have no common exported type; callers pass drizzle-core objects (tables, SQL) whose generics differ per dialect, so a precise signature cannot be written once for both.
type BuilderFn = (...args: any[]) => any;

/** The minimal builder surface the repository uses. */
export type QueryDb = {
  select: BuilderFn;
  insert: BuilderFn;
  update: BuilderFn;
  delete: BuilderFn;
};

export function asQueryDb(db: unknown): QueryDb {
  return db as QueryDb;
}
