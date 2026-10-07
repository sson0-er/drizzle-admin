import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const role = pgEnum("role", ["admin", "editor", "viewer"]);
export const mood = pgEnum("mood", ["calm", "busy"]);

export const authors = pgTable("authors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  email: text("email"),
  active: boolean("active").notNull().default(true),
  role: role("role").notNull().default("viewer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body"),
  authorId: integer("author_id")
    .notNull()
    .references(() => authors.id),
  publishedAt: timestamp("published_at"),
  meta: jsonb("meta"),
  views: integer("views"),
  score: real("score"),
  big: bigint("big", { mode: "bigint" }),
});

export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: text("value"),
});

// PG-only: date-only values, uuid, numeric and enum columns (decisions 018, 019, 023).
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  day: date("day", { mode: "date" }).notNull(),
  code: uuid("code").defaultRandom().notNull(),
  amount: numeric("amount"),
  mood: mood("mood"),
  note: text("note"),
  due: date("due"),
});

// PG-only: identity primary key and text vs varchar, for introspection.
export const tags = pgTable("tags", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  label: varchar("label", { length: 50 }).notNull(),
  description: text("description"),
});
