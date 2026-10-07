// Dialect-aware row access built on the pure condition builders in query.ts. DB errors propagate
// unchanged; callers classify them (errors.ts).
import { and, type Column, count, eq, getTableColumns, inArray } from "drizzle-orm";
import type { Dialect, ModelMeta } from "../introspect/index.js";
import { asQueryDb } from "./db.js";
import { buildFilters, buildOrderBy, buildSearch, type OrderItem, parsePk } from "./query.js";

export interface ListParams {
  q?: string;
  searchFields: string[];
  filters: Record<string, string>;
  ordering: OrderItem[];
  /** 1-based. */
  page: number;
  perPage: number;
}

export type DbRow = Record<string, unknown>;

export interface Repository {
  list(meta: ModelMeta, p: ListParams): Promise<{ rows: DbRow[]; total: number }>;
  get(meta: ModelMeta, pk: string): Promise<DbRow | null>;
  getMany(meta: ModelMeta, pks: readonly string[]): Promise<DbRow[]>;
  create(meta: ModelMeta, data: Record<string, unknown>): Promise<DbRow>;
  update(meta: ModelMeta, pk: string, data: Record<string, unknown>): Promise<DbRow | null>;
  delete(meta: ModelMeta, pks: readonly string[]): Promise<number>;
  options(
    meta: ModelMeta,
    opts: { limit: number; ordering: OrderItem[]; toLabel: (row: DbRow) => string },
  ): Promise<{ value: string; label: string }[]>;
}

export function createRepository(cfg: {
  db: unknown;
  dialect: Dialect;
  timeZone: string;
  now?: () => Date;
}): Repository {
  const db = asQueryDb(cfg.db);
  const now = cfg.now ?? (() => new Date());

  const pkColumn = (meta: ModelMeta): Column => {
    const col = getTableColumns(meta.table)[meta.pk.key];
    if (!col) throw new Error(`drizzle-admin: no primary key column on "${meta.tableName}"`);
    return col;
  };

  // Invalid strings never reach SQL; duplicates are dropped so each row is matched once.
  const parsePks = (meta: ModelMeta, pks: readonly string[]) => {
    const values = new Set<string | number | bigint>();
    for (const raw of pks) {
      const v = parsePk(meta.pk, raw);
      if (v !== null) values.add(v);
    }
    return [...values];
  };

  const get = async (meta: ModelMeta, pk: string): Promise<DbRow | null> => {
    const v = parsePk(meta.pk, pk);
    if (v === null) return null;
    const rows: DbRow[] = await db
      .select()
      .from(meta.table)
      .where(eq(pkColumn(meta), v))
      .limit(1);
    return rows[0] ?? null;
  };

  return {
    async list(meta, p) {
      const where = and(
        buildSearch(meta, p.searchFields, p.q, cfg.dialect),
        ...buildFilters(meta, p.filters, cfg.timeZone, now()),
      );
      const totals: { count: number | string }[] = await db
        .select({ count: count() })
        .from(meta.table)
        .where(where);
      const rows: DbRow[] = await db
        .select()
        .from(meta.table)
        .where(where)
        .orderBy(...buildOrderBy(meta, p.ordering))
        .limit(p.perPage)
        .offset((p.page - 1) * p.perPage);
      return { rows, total: Number(totals[0]?.count ?? 0) };
    },

    get,

    async getMany(meta, pks) {
      const values = parsePks(meta, pks);
      if (values.length === 0) return [];
      return await db
        .select()
        .from(meta.table)
        .where(inArray(pkColumn(meta), values));
    },

    async create(meta, data) {
      const rows: DbRow[] = await db.insert(meta.table).values(data).returning();
      const row = rows[0];
      if (!row) throw new Error(`drizzle-admin: insert into "${meta.tableName}" returned no row`);
      return row;
    },

    async update(meta, pk, data) {
      const v = parsePk(meta.pk, pk);
      if (v === null) return null;
      // Drizzle rejects an empty set().
      if (Object.keys(data).length === 0) return get(meta, pk);
      const rows: DbRow[] = await db
        .update(meta.table)
        .set(data)
        .where(eq(pkColumn(meta), v))
        .returning();
      return rows[0] ?? null;
    },

    async delete(meta, pks) {
      const values = parsePks(meta, pks);
      if (values.length === 0) return 0;
      const col = pkColumn(meta);
      const rows: unknown[] = await db
        .delete(meta.table)
        .where(inArray(col, values))
        .returning({ pk: col });
      return rows.length;
    },

    async options(meta, opts) {
      const rows: DbRow[] = await db
        .select()
        .from(meta.table)
        .orderBy(...buildOrderBy(meta, opts.ordering))
        .limit(opts.limit);
      return rows.map((row) => ({ value: String(row[meta.pk.key]), label: opts.toLabel(row) }));
    },
  };
}
