import { sql } from "drizzle-orm";
import { blob, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  email: text("email"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  role: text("role", { enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("viewer"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body"),
  authorId: integer("author_id")
    .notNull()
    .references(() => authors.id),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  meta: text("meta", { mode: "json" }),
  views: integer("views"),
  score: real("score"),
  big: blob("big", { mode: "bigint" }),
});

export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value"),
});
