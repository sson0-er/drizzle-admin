import { jsx } from "hono/jsx";
import { ACTION_PERMISSION, can } from "../auth/permissions.js";
import type { DbRow } from "../data/repository.js";
import type { FieldMeta } from "../introspect/index.js";
import { messages } from "../messages.js";
import type { AdminUser, ResolvedModel } from "../types.js";
import { formatCell } from "../views/format.js";
import { type Cell, ListPage, type ListPageProps } from "../views/list.js";
import { type SortState, sortHref, withQuery } from "../views/url.js";
import {
  type AdminContext,
  defaultOrdering,
  errorPage,
  modelOr404,
  pageChrome,
  renderPage,
  requireUser,
} from "./context.js";

const FK_FILTER_LIMIT = 200;
const DATE_PRESETS = [
  { value: "today", label: messages.today },
  { value: "past7", label: messages.past7 },
  { value: "month", label: messages.thisMonth },
  { value: "year", label: messages.thisYear },
] as const;

const enc = (pk: unknown): string => encodeURIComponent(String(pk));

type OrderItem = { key: string; desc: boolean };

/** `o` as written by the user: only `listDisplay` keys, each once (decision 013 item 6). */
function parseOrdering(raw: string | null, allowed: readonly string[]): OrderItem[] {
  const items: OrderItem[] = [];
  for (const part of (raw ?? "").split(",")) {
    const desc = part.startsWith("-");
    const key = desc ? part.slice(1) : part;
    if (allowed.includes(key) && !items.some((i) => i.key === key)) items.push({ key, desc });
  }
  return items;
}

function parsePage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : 1;
}

const isDateFilter = (f: FieldMeta): boolean => f.kind === "date" || f.isDateOnly;

/**
 * Keys of FK fields whose referenced model is registered but not viewable by the user. Such a
 * column shows the raw value only: no label, link or filter (decision 034).
 */
function hiddenFkKeys(c: AdminContext, model: ResolvedModel, user: AdminUser): Set<string> {
  const hidden = new Set<string>();
  for (const field of model.meta.fields) {
    const slug = field.foreignKey?.slug;
    const ref = slug === undefined ? undefined : c.var.state.models.get(slug);
    if (ref !== undefined && !can(ref, "view", user)) hidden.add(field.key);
  }
  return hidden;
}

/** Labels of the referenced rows for each FK column: one `getMany` per column, never per row. */
async function loadFkLabels(
  c: AdminContext,
  model: ResolvedModel,
  rows: DbRow[],
  hidden: ReadonlySet<string>,
): Promise<Map<string, Map<string, string>>> {
  const { repo, state } = c.var;
  const labels = new Map<string, Map<string, string>>();
  for (const key of model.listDisplay) {
    const slug = model.meta.fields.find((f) => f.key === key)?.foreignKey?.slug;
    if (slug === undefined || hidden.has(key) || Object.hasOwn(model.formatters, key)) continue;
    const ref = state.models.get(slug);
    if (ref === undefined) continue;
    const values = new Set<string>();
    for (const row of rows) {
      const v = row[key];
      if (v !== null && v !== undefined) values.add(String(v));
    }
    const byPk = new Map<string, string>();
    for (const refRow of await repo.getMany(ref.meta, [...values])) {
      byPk.set(String(refRow[ref.meta.pk.key]), ref.toString(refRow));
    }
    labels.set(key, byPk);
  }
  return labels;
}

type Choice = { label: string; value: string };

async function filterChoices(c: AdminContext, field: FieldMeta): Promise<Choice[] | null> {
  if (isDateFilter(field)) return DATE_PRESETS.map((p) => ({ label: p.label, value: p.value }));
  if (field.kind === "boolean") {
    return [
      { label: messages.yes, value: "1" },
      { label: messages.no, value: "0" },
    ];
  }
  if (field.kind === "enum") return (field.enumValues ?? []).map((v) => ({ label: v, value: v }));
  const slug = field.foreignKey?.slug;
  const ref = slug === undefined ? undefined : c.var.state.models.get(slug);
  if (ref === undefined) return null;
  const options = await c.var.repo.options(ref.meta, {
    limit: FK_FILTER_LIMIT,
    ordering: defaultOrdering(ref),
    toLabel: ref.toString,
  });
  return options.map((o) => ({ label: o.label, value: o.value }));
}

/** `GET ${prefix}/:model/`: search, filters, ordering and pagination of one model. */
export async function listHandler(c: AdminContext): Promise<Response> {
  const found = modelOr404(c, c.req.param("model") ?? "");
  if (found instanceof Response) return found;
  const model = found;
  const user = requireUser(c);
  if (!can(model, "view", user)) return errorPage(c, 403, messages.forbidden);

  const { repo, state } = c.var;
  const { prefix, timeZone } = state.config;
  const listUrl = `${prefix}/${model.slug}/`;
  const url = new URL(c.req.url);
  const params = url.searchParams;

  const searchable = model.searchFields.length > 0;
  const q = searchable ? (params.get("q") ?? "") : null;
  const userOrdering = parseOrdering(params.get("o"), model.listDisplay);
  const ordering = userOrdering.length > 0 ? userOrdering : defaultOrdering(model);
  const hiddenFk = hiddenFkKeys(c, model, user);
  const filters: Record<string, string> = {};
  for (const key of model.listFilter) {
    if (hiddenFk.has(key)) continue;
    const value = params.get(`f_${key}`);
    if (value !== null && value !== "") filters[key] = value;
  }
  const page = parsePage(params.get("p"));

  const { rows, total } = await repo.list(model.meta, {
    ...(q === null || q === "" ? {} : { q }),
    searchFields: model.searchFields,
    filters,
    ordering,
    page,
    perPage: model.listPerPage,
  });

  const fkLabels = await loadFkLabels(c, model, rows, hiddenFk);
  const fieldByKey = new Map(model.meta.fields.map((f) => [f.key, f]));
  const changeHref = (row: DbRow) => `${listUrl}${enc(row[model.meta.pk.key])}/change/`;

  const tableRows: ListPageProps["rows"] = rows.map((row) => {
    const cells = model.listDisplay.map((key): Cell => {
      const field = fieldByKey.get(key);
      if (field === undefined) return { text: "-" };
      const value = row[key];
      const fkLabel =
        value === null || value === undefined ? undefined : fkLabels.get(key)?.get(String(value));
      const formatter = model.formatters[key];
      const text = formatCell({
        field,
        value,
        row,
        tz: timeZone,
        ...(formatter === undefined ? {} : { formatter }),
        ...(fkLabel === undefined ? {} : { fkLabel }),
      });
      if (model.listDisplayLinks.includes(key)) return { text, href: changeHref(row) };
      const refSlug = field.foreignKey?.slug;
      if (
        refSlug !== undefined &&
        !hiddenFk.has(key) &&
        formatter === undefined &&
        value !== null &&
        value !== undefined
      ) {
        return { text, href: `${prefix}/${refSlug}/${enc(value)}/change/` };
      }
      return { text };
    });
    return { pk: String(row[model.meta.pk.key]), cells };
  });

  const columns = model.listDisplay.map((key) => {
    const entry = userOrdering.find((i) => i.key === key);
    const sort: SortState = entry === undefined ? "none" : entry.desc ? "desc" : "asc";
    return { key, sort, sortHref: sortHref(listUrl, params, key, sort) };
  });

  const filterProps: ListPageProps["filters"] = [];
  for (const key of model.listFilter) {
    const field = fieldByKey.get(key);
    if (field === undefined || hiddenFk.has(key)) continue;
    const choices = await filterChoices(c, field);
    if (choices === null) continue;
    // For boolean, enum and date filters `buildFilters` ignores an unknown value, so "all" is
    // right. A valid FK key outside the offered choices still filters while "all" shows as
    // selected (accepted, decision 033 item 5).
    const active = choices.find((ch) => ch.value === filters[key])?.value ?? null;
    const param = `f_${key}`;
    filterProps.push({
      key,
      choices: [{ label: messages.all, value: null }, ...choices].map((ch) => ({
        label: ch.label,
        href: withQuery(listUrl, params, { [param]: ch.value }),
        selected: ch.value === active,
      })),
    });
  }

  const actions: ListPageProps["actions"] = [];
  if (can(model, "delete", user)) {
    actions.push({ name: "delete_selected", label: messages.deleteSelected });
  }
  if (can(model, ACTION_PERMISSION, user)) {
    for (const a of model.actions) actions.push({ name: a.name, label: a.label });
  }

  const pages = Math.max(1, Math.ceil(total / model.listPerPage));
  return renderPage(c, 200, (flash) =>
    jsx(ListPage, {
      ...pageChrome(c, model.label, [{ label: model.label }], flash),
      model: { slug: model.slug, label: model.label },
      columns,
      rows: tableRows,
      q,
      filters: filterProps,
      actions,
      canAdd: can(model, "add", user),
      page,
      pages,
      total,
      pageHref: (n: number) => withQuery(listUrl, params, { p: String(n) }),
      backQuery: url.search,
    }),
  );
}
