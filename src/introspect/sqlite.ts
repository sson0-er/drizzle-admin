import { type Column, is, type Table } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DialectAdapter } from "./index.js";

export const sqliteAdapter: DialectAdapter = {
  label: "SQLite",
  isTable: (table) => is(table, SQLiteTable),
  getConfig(table: Table) {
    const config = getTableConfig(table as SQLiteTable);
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
