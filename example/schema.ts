import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text().notNull(),
  role: text({ enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("viewer"),
  isActive: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: integer({ mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const posts = sqliteTable("posts", {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  body: text(),
  status: text({ enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  authorId: integer()
    .notNull()
    .references(() => users.id),
  publishedAt: integer({ mode: "timestamp" }),
  metadata: text({ mode: "json" }),
});

export const tags = sqliteTable("tags", {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});
