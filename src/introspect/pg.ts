import { type Column, is, type Table } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import type { DialectAdapter } from "./index.js";

export const pgAdapter: DialectAdapter = {
  label: "PostgreSQL",
  isTable: (table) => is(table, PgTable),
  getConfig(table: Table) {
    const config = getTableConfig(table as PgTable);
    return {
      primaryKeyColumns: config.primaryKeys.flatMap((pk): Column[] => pk.columns),
      foreignKeys: config.foreignKeys.map((fk) => {
        const ref = fk.reference();
        return {
          columns: ref.columns as Column[],
          foreignTable: ref.foreignTable as Table,
          foreignColumns: ref.foreignColumns as Column[],
        };
      }),
    };
  },
};
