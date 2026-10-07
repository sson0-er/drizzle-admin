// biome-ignore-all lint/suspicious/noConfusingVoidType: `void` lets callbacks that return nothing satisfy the §5.2 signatures
import type { Table } from "drizzle-orm";
import type { Hono } from "hono";
import type { Dialect, ModelMeta } from "./introspect/index.js";

// Public types (design: interfaces/admin.md "Public types"; §5.2 plus publicOrigin and HookCtx).

export type ColumnKey<T extends Table> = keyof T["$inferSelect"] & string;
export type Row<T extends Table> = T["$inferSelect"];

export interface AdminConfig {
  db: unknown;
  dialect: "sqlite" | "postgres";
  basePath: string;
  siteTitle?: string;
  secret: string;
  auth: AuthConfig;
  sessionMaxAgeSec?: number;
  timeZone?: string;
  /** Public origin behind a reverse proxy, e.g. "https://admin.example.com" (decision 017). */
  publicOrigin?: string;
}

export interface AuthConfig {
  verifyCredentials?: (username: string, password: string) => Promise<AdminUser | null>;
  getUser?: (req: Request) => Promise<AdminUser | null>;
  loginUrl?: string;
}

export interface AdminUser {
  id: string;
  name: string;
}

export type WidgetType =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "select"
  | "date"
  | "datetime"
  | "json"
  | "password"
  | "hidden";

export interface HookCtx {
  mode: "add" | "change" | "delete";
  user: AdminUser;
  db: unknown;
}

export interface ModelAdminOptions<T extends Table> {
  slug?: string;
  label?: string;
  listDisplay?: ColumnKey<T>[];
  listDisplayLinks?: ColumnKey<T>[];
  searchFields?: ColumnKey<T>[];
  listFilter?: ColumnKey<T>[];
  ordering?: (ColumnKey<T> | `-${ColumnKey<T>}`)[];
  listPerPage?: number;
  fields?: ColumnKey<T>[];
  exclude?: ColumnKey<T>[];
  readonlyFields?: ColumnKey<T>[];
  fieldsets?: { title?: string; fields: ColumnKey<T>[] }[];
  widgets?: Partial<Record<ColumnKey<T>, WidgetType>>;
  formatters?: Partial<Record<ColumnKey<T>, (value: unknown, row: Row<T>) => string>>;
  toString?: (row: Row<T>) => string;
  validate?: (
    data: Partial<Row<T>>,
    ctx: { mode: "add" | "change" },
  ) => Promise<Record<string, string> | void> | Record<string, string> | void;
  hooks?: {
    beforeSave?: (
      data: Partial<Row<T>>,
      ctx: HookCtx,
    ) => Promise<Partial<Row<T>>> | Partial<Row<T>>;
    afterSave?: (row: Row<T>, ctx: HookCtx) => Promise<void> | void;
    beforeDelete?: (row: Row<T>, ctx: HookCtx) => Promise<void> | void;
  };
  permissions?: {
    view?: boolean | ((user: AdminUser) => boolean);
    add?: boolean | ((user: AdminUser) => boolean);
    change?: boolean | ((user: AdminUser) => boolean);
    delete?: boolean | ((user: AdminUser) => boolean);
  };
  actions?: AdminAction<T>[];
}

// biome-ignore lint/correctness/noUnusedVariables: T is kept for compatibility with the §5.2 signature
export interface AdminAction<T extends Table> {
  name: string;
  label: string;
  confirm?: boolean;
  run: (ctx: {
    ids: string[];
    db: unknown;
    user: AdminUser;
  }) => Promise<{ message?: string } | void>;
}

export interface Admin {
  register<T extends Table>(table: T, options?: ModelAdminOptions<T>): void;
  /** Getter; the first access finalizes the registry. */
  readonly app: Hono;
  /** The first call finalizes the registry. */
  fetch(request: Request): Promise<Response>;
}

// Internal types (design: interfaces/admin.md "Data formats"). Not exported from src/index.ts.

type ValidateResult = Promise<Record<string, string> | void> | Record<string, string> | void;

export interface ResolvedModel {
  slug: string;
  label: string;
  meta: ModelMeta;
  listDisplay: string[];
  listDisplayLinks: string[];
  searchFields: string[];
  listFilter: string[];
  ordering: { key: string; desc: boolean }[];
  listPerPage: number;
  fieldsets: { title?: string; fields: string[] }[];
  readonlyFields: ReadonlySet<string>;
  widgets: Readonly<Record<string, WidgetType>>;
  formatters: Readonly<Record<string, (value: unknown, row: Record<string, unknown>) => string>>;
  toString: (row: Record<string, unknown>) => string;
  validate?: (data: Record<string, unknown>, ctx: { mode: "add" | "change" }) => ValidateResult;
  hooks: {
    beforeSave?: (
      data: Record<string, unknown>,
      ctx: HookCtx,
    ) => Promise<Record<string, unknown>> | Record<string, unknown>;
    afterSave?: (row: Record<string, unknown>, ctx: HookCtx) => Promise<void> | void;
    beforeDelete?: (row: Record<string, unknown>, ctx: HookCtx) => Promise<void> | void;
  };
  permissions: Record<"view" | "add" | "change" | "delete", (user: AdminUser) => boolean>;
  /** Custom actions only; the built-in delete is added by the routes. */
  actions: AdminAction<Table>[];
}

export interface AdminState {
  config: {
    db: unknown;
    dialect: Dialect;
    prefix: string;
    siteTitle: string;
    secret: string;
    sessionMaxAgeSec: number;
    timeZone: string;
    authMode: "builtin" | "external";
    auth: AuthConfig;
    /** Normalized origin (see createAdmin), or null when not configured. */
    publicOrigin: string | null;
  };
  /** By slug, in registration order. */
  models: ReadonlyMap<string, ResolvedModel>;
  modelByTable: ReadonlyMap<Table, ResolvedModel>;
}
