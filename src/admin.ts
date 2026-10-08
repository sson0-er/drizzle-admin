import type { Table } from "drizzle-orm";
import { Hono } from "hono";
import { allowedWidgets } from "./forms/fields.js";
import { type FieldMeta, introspectTable } from "./introspect/index.js";
import { messages } from "./messages.js";
import { MAX_SELECTED } from "./routes/actions.js";
import { buildApp } from "./routes/index.js";
import { resolveTimeZone } from "./time.js";
import type {
  Admin,
  AdminConfig,
  AdminState,
  AdminUser,
  ModelAdminOptions,
  ResolvedModel,
} from "./types.js";

const fail = (message: string): never => {
  throw new Error(`drizzle-admin: ${message}`);
};

function normalizeBasePath(basePath: unknown): string {
  if (typeof basePath !== "string" || !basePath.startsWith("/") || /[?#\\\s]|\/\//.test(basePath)) {
    return fail('basePath must start with "/" and contain no "?", "#", "\\", whitespace or "//"');
  }
  // "/" becomes "" so that `${prefix}/x` never yields a double slash.
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

function normalizePublicOrigin(value: unknown): string {
  const invalid = () =>
    fail(
      "publicOrigin must be an http(s) origin without credentials, path, query or fragment, e.g. https://admin.example.com",
    );
  // `new URL` drops an empty "?" / "#", so reject them on the raw string first.
  if (typeof value !== "string" || /[?#]/.test(value)) return invalid();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid();
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/"
  ) {
    return invalid();
  }
  return url.origin;
}

/**
 * Validates and normalizes `config`. Internal: exported for tests, not from src/index.ts.
 * Every failure throws `Error("drizzle-admin: <message>")`.
 */
export function resolveConfig(config: AdminConfig): AdminState["config"] {
  const { db, dialect, secret, auth, sessionMaxAgeSec } = config;
  if (db === null || db === undefined || typeof db !== "object") {
    fail("db must be a database object");
  }
  if (dialect !== "sqlite" && dialect !== "postgres") {
    fail('dialect must be "sqlite" or "postgres"');
  }
  if (typeof secret !== "string" || secret.length < 32) {
    fail("secret must be a string of at least 32 characters");
  }
  const prefix = normalizeBasePath(config.basePath);
  const hasGetUser = typeof auth?.getUser === "function";
  if (!hasGetUser && typeof auth?.verifyCredentials !== "function") {
    fail("auth must provide verifyCredentials or getUser");
  }
  if (
    sessionMaxAgeSec !== undefined &&
    // hono's cookie serializer throws for a Max-Age above 400 days, which would 500 every page.
    (!Number.isInteger(sessionMaxAgeSec) || sessionMaxAgeSec <= 0 || sessionMaxAgeSec > 34560000)
  ) {
    fail("sessionMaxAgeSec must be a positive integer of at most 34560000 (400 days)");
  }
  return {
    db,
    dialect,
    prefix,
    siteTitle: config.siteTitle ?? messages.defaultSiteTitle,
    secret,
    sessionMaxAgeSec: sessionMaxAgeSec ?? 28800,
    timeZone: resolveTimeZone(config.timeZone),
    // getUser wins when both are set (decision 013 item 8).
    authMode: hasGetUser ? "external" : "builtin",
    auth,
    publicOrigin:
      config.publicOrigin === undefined ? null : normalizePublicOrigin(config.publicOrigin),
  };
}

const SLUG_PATTERN = /^[A-Za-z0-9_-]+$/;
const RESERVED_SLUGS = new Set(["login", "logout", "static"]);
const DEFAULT_LIST_DISPLAY_EXTRA = 4;

/** Options after the column-name generics are widened to plain strings. */
type RawOptions = Partial<
  Pick<ResolvedModel, "slug" | "label" | "listPerPage" | "toString" | "validate" | "hooks">
> & {
  listDisplay?: string[];
  listDisplayLinks?: string[];
  searchFields?: string[];
  listFilter?: string[];
  ordering?: string[];
  fields?: string[];
  exclude?: string[];
  readonlyFields?: string[];
  fieldsets?: { title?: string; fields: string[] }[];
  widgets?: Record<string, ResolvedModel["widgets"][string]>;
  formatters?: ResolvedModel["formatters"];
  permissions?: ModelAdminOptions<Table>["permissions"];
  actions?: ResolvedModel["actions"];
};

function toPermission(
  value: boolean | ((user: AdminUser) => boolean) | undefined,
): (user: AdminUser) => boolean {
  if (typeof value === "function") return value;
  const allowed = value ?? true;
  return () => allowed;
}

/** Fields filtered by a fixed widget (not by FK choices). */
const isPlainFilter = (f: FieldMeta) =>
  f.kind === "boolean" || f.kind === "enum" || f.kind === "date" || f.isDateOnly;

const isFilterable = (f: FieldMeta) => isPlainFilter(f) || f.foreignKey !== undefined;

function resolveModel(
  table: Table,
  rawOptions: unknown,
  dialect: AdminState["config"]["dialect"],
  models: ReadonlyMap<string, ResolvedModel>,
): ResolvedModel {
  const options = (rawOptions ?? {}) as RawOptions;
  const meta = introspectTable(table, dialect);
  const name = meta.tableName;

  const slug = options.slug ?? name;
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    fail(`${name}: slug "${String(slug)}" may contain only letters, digits, "_" and "-"`);
  }
  if (RESERVED_SLUGS.has(slug)) fail(`${name}: slug "${slug}" is reserved`);
  if (models.has(slug)) fail(`${name}: slug "${slug}" is already registered`);

  const byKey = new Map(meta.fields.map((f) => [f.key, f]));
  const column = (option: string, key: string): FieldMeta =>
    byKey.get(key) ?? fail(`${name}: option "${option}" references unknown column "${key}"`);
  const columns = (option: string, keys: string[] | undefined): FieldMeta[] =>
    (keys ?? []).map((key) => column(option, key));

  columns("listDisplay", options.listDisplay);
  columns("listDisplayLinks", options.listDisplayLinks);
  const searchFields = columns("searchFields", options.searchFields);
  const listFilter = columns("listFilter", options.listFilter);
  const ordering = (options.ordering ?? []).map((entry) => {
    const desc = entry.startsWith("-");
    const key = desc ? entry.slice(1) : entry;
    column("ordering", key);
    return { key, desc };
  });
  columns("fields", options.fields);
  columns("exclude", options.exclude);
  columns("readonlyFields", options.readonlyFields);
  for (const fieldset of options.fieldsets ?? []) columns("fieldsets", fieldset.fields);
  const widgetEntries = Object.entries(options.widgets ?? {});
  for (const [key] of widgetEntries) column("widgets", key);
  for (const key of Object.keys(options.formatters ?? {})) column("formatters", key);

  for (const f of listFilter) {
    if (!isFilterable(f)) {
      fail(`${name}: listFilter "${f.key}" must be a boolean, enum, date or foreign key column`);
    }
  }
  for (const f of searchFields) {
    if (f.kind !== "string" && f.kind !== "enum") {
      fail(`${name}: searchFields "${f.key}" must be a string or enum column`);
    }
  }
  if (options.fields !== undefined && options.fieldsets !== undefined) {
    fail(`${name}: options "fields" and "fieldsets" cannot both be set`);
  }
  const actionNames = new Set<string>();
  for (const action of options.actions ?? []) {
    if (typeof action.name !== "string" || action.name === "") {
      fail(`${name}: action name must be a non-empty string`);
    }
    if (action.name === "delete_selected") {
      fail(`${name}: action name "delete_selected" is reserved`);
    }
    if (actionNames.has(action.name)) fail(`${name}: duplicate action name "${action.name}"`);
    actionNames.add(action.name);
  }
  const listPerPage = options.listPerPage ?? 50;
  if (!Number.isInteger(listPerPage) || listPerPage <= 0 || listPerPage > MAX_SELECTED) {
    fail(`${name}: listPerPage must be a positive integer of at most ${MAX_SELECTED}`);
  }
  for (const [key, widget] of widgetEntries) {
    const field = column("widgets", key);
    if (!allowedWidgets(field).includes(widget)) {
      fail(`${name}: widget "${widget}" is not allowed for field "${key}" (kind ${field.kind})`);
    }
  }
  for (const [key, widget] of widgetEntries) {
    if (widget !== "password") continue;
    if (key === meta.pk.key) {
      fail(`${name}: the primary key "${key}" cannot use the password widget`);
    }
    if (searchFields.some((f) => f.key === key)) {
      fail(`${name}: field "${key}" uses the password widget and cannot be in searchFields`);
    }
    if (ordering.some((o) => o.key === key)) {
      fail(`${name}: field "${key}" uses the password widget and cannot be in ordering`);
    }
  }

  const label = options.label ?? name;
  // `options.toString` would otherwise resolve to Object.prototype.toString when unset.
  const customToString = Object.hasOwn(options, "toString") ? options.toString : undefined;
  const excluded = new Set(options.exclude);
  const defaultDisplay = [
    meta.pk.key,
    ...meta.fields.filter((f) => !f.isPrimaryKey).map((f) => f.key),
  ]
    .filter((key) => !excluded.has(key))
    .slice(0, 1 + DEFAULT_LIST_DISPLAY_EXTRA);
  // A list needs at least one column, so excluding every column falls back to the primary key.
  const listDisplay =
    options.listDisplay ?? (defaultDisplay.length > 0 ? defaultDisplay : [meta.pk.key]);
  const withoutExcluded = (keys: string[]) => keys.filter((key) => !excluded.has(key));
  const fieldsets = options.fieldsets
    ? options.fieldsets.map((fs) => ({
        ...(fs.title === undefined ? {} : { title: fs.title }),
        fields: withoutExcluded(fs.fields),
      }))
    : [{ fields: withoutExcluded(options.fields ?? meta.fields.map((f) => f.key)) }];

  const view = toPermission(options.permissions?.view);
  // Unset write permissions follow `view`, so restricting `view` alone closes the model (decision 043).
  const inherit = (entry: boolean | ((user: AdminUser) => boolean) | undefined) =>
    entry === undefined ? view : toPermission(entry);

  return {
    slug,
    label,
    meta,
    listDisplay,
    listDisplayLinks: options.listDisplayLinks ?? listDisplay.slice(0, 1),
    searchFields: searchFields.map((f) => f.key),
    listFilter: listFilter.map((f) => f.key),
    ordering,
    listPerPage,
    fieldsets,
    readonlyFields: new Set(options.readonlyFields),
    widgets: { ...options.widgets },
    formatters: { ...options.formatters },
    toString: customToString ?? ((row) => `${label} #${String(row[meta.pk.key])}`),
    ...(options.validate === undefined ? {} : { validate: options.validate }),
    hooks: options.hooks ?? {},
    permissions: {
      view,
      add: inherit(options.permissions?.add),
      change: inherit(options.permissions?.change),
      delete: inherit(options.permissions?.delete),
    },
    actions: options.actions ?? [],
  };
}

/** Resolves FK slugs and runs the cross-model checks that need every model to be known. */
function resolveForeignKeys(models: ReadonlyMap<string, ResolvedModel>): void {
  for (const model of models.values()) {
    for (const field of model.meta.fields) {
      const fk = field.foreignKey;
      if (fk === undefined) continue;
      const target = [...models.values()].find(
        (m) => m.meta.table === fk.table && fk.column === m.meta.pk.key,
      );
      if (target !== undefined) fk.slug = target.slug;
    }
  }
  for (const model of models.values()) {
    const name = model.meta.tableName;
    const fieldByKey = new Map(model.meta.fields.map((f) => [f.key, f]));
    for (const key of model.listFilter) {
      const field = fieldByKey.get(key);
      if (field?.foreignKey !== undefined && !isPlainFilter(field) && !field.foreignKey.slug) {
        fail(
          `${name}: listFilter "${key}" needs the referenced table to be registered and referenced by its primary key`,
        );
      }
    }
    for (const [key, widget] of Object.entries(model.widgets)) {
      const field = fieldByKey.get(key);
      if (
        widget === "select" &&
        field?.foreignKey !== undefined &&
        field.kind !== "enum" &&
        !field.foreignKey.slug
      ) {
        fail(
          `${name}: widget "select" for "${key}" needs the referenced table to be registered and referenced by its primary key`,
        );
      }
    }
  }
}

// Per-admin registry, reachable only through `resolvedModels` (tests); not part of the Admin API.
const registries = new WeakMap<Admin, ReadonlyMap<string, ResolvedModel>>();

/** Internal: the registered models by slug. Exported for tests, not from src/index.ts. */
export function resolvedModels(admin: Admin): ReadonlyMap<string, ResolvedModel> {
  return registries.get(admin) ?? new Map();
}

export function createAdmin(config: AdminConfig): Admin {
  const resolvedConfig = resolveConfig(config);
  const models = new Map<string, ResolvedModel>();
  let app: Hono | undefined;
  let mounted: Hono | undefined;

  // Idempotent: runs once, on the first `app` / `fetch` access. A failure leaves the registry
  // unfinalized, so the same error is thrown again on the next access.
  const finalize = (): Hono => {
    if (app === undefined) {
      resolveForeignKeys(models);
      const modelByTable = new Map([...models.values()].map((m) => [m.meta.table, m]));
      app = buildApp({ config: resolvedConfig, models, modelByTable });
    }
    return app;
  };

  const admin: Admin = {
    register(table, options) {
      if (app !== undefined) {
        fail("register() must be called before admin.app / admin.fetch is used");
      }
      const model = resolveModel(table, options, resolvedConfig.dialect, models);
      models.set(model.slug, model);
    },
    get app() {
      return finalize();
    },
    fetch(request) {
      mounted ??= new Hono().route(resolvedConfig.prefix || "/", finalize());
      return Promise.resolve(mounted.fetch(request));
    },
  };
  registries.set(admin, models);
  return admin;
}
